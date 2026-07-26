from __future__ import annotations

from pydantic import BaseModel, Field

from app import config
from app.llm import LLM, gather_structured, get_llm
from app.models import (
    NOTE_TYPES_BY_AGENT,
    AgentId,
    AudienceReaction,
    Beat,
    DropEvent,
    Note,
    NoteType,
    Warning,
)
from app.prompts import expert
from app.stages.a1_parse import beats_digest


AGENT_IDS: tuple[AgentId, ...] = tuple(AgentId)

NOTE_LABELS: dict[NoteType, str] = {
    NoteType.UNPLAYABLE_BEAT: "Beat cannot be staged",
    NoteType.NO_VISUAL_ANCHOR: "No visual anchor",
    NoteType.BLOCKING_UNCLEAR: "Blocking is unclear",
    NoteType.TONE_UNDIRECTED: "Tone lacks direction",
    NoteType.CUT_CANDIDATE: "Cut candidate",
    NoteType.MOVE_EARLIER: "Move earlier",
    NoteType.SCENE_OVERLONG: "Scene runs long",
    NoteType.ENTRY_TOO_LATE: "Scene starts too late",
    NoteType.CLICHE: "Feels clichéd",
    NoteType.DERIVATIVE_STRUCTURE: "Structure feels derivative",
    NoteType.UNEARNED_TURN: "Turn feels unearned",
    NoteType.DISTINCTIVE: "Distinctive material",
    NoteType.MOTIVATION_UNSUPPORTED: "Motivation is unsupported",
    NoteType.EMOTIONAL_SKIP: "Emotional step is missing",
    NoteType.INCONSISTENT_BEHAVIOUR: "Behaviour is inconsistent",
    NoteType.RELATIONSHIP_UNGROUNDED: "Relationship is ungrounded",
    NoteType.PERIOD_INCONSISTENT: "Period detail is inconsistent",
    NoteType.CULTURAL_MISFIT: "Cultural detail does not fit",
    NoteType.REGISTER_WRONG: "Register feels wrong",
    NoteType.DETAIL_UNGROUNDED: "Detail is ungrounded",
}

# The axis is not "positive vs negative" — it is what the note wants DONE to
# the material. The Editor's notes all argue for less of it. The Historian's
# argue that the world is not specific enough, which is an argument for truer
# and usually *more* texture, and the Critic's DISTINCTIVE says the material
# has earned its place. Those pull against a cut.
#
# This matters because the Editor wanting to cut a scene while the Historian
# defends it as authenticity is the most interesting thing on screen. With
# only DISTINCTIVE in here the Historian could never disagree with anyone and
# that conflict was unrepresentable.
DEFENDING_NOTE_TYPES: frozenset[NoteType] = frozenset(
    {
        NoteType.DISTINCTIVE,
        NoteType.PERIOD_INCONSISTENT,
        NoteType.CULTURAL_MISFIT,
        NoteType.REGISTER_WRONG,
        NoteType.DETAIL_UNGROUNDED,
    }
)
ATTACKING_NOTE_TYPES: frozenset[NoteType] = frozenset(
    {
        NoteType.CUT_CANDIDATE,
        NoteType.MOVE_EARLIER,
        NoteType.SCENE_OVERLONG,
        NoteType.ENTRY_TOO_LATE,
        NoteType.CLICHE,
        NoteType.DERIVATIVE_STRUCTURE,
        NoteType.UNEARNED_TURN,
    }
)


class ExpertNoteDraft(BaseModel):
    beat_id: int
    note_type: NoteType
    text: str
    evidence: str
    severity: int = Field(ge=1, le=5)
    anchored_to_drop: str | None = None


class ExpertNoteDraftList(BaseModel):
    notes: list[ExpertNoteDraft]


def _drops_digest(drop_events: list[DropEvent]) -> str:
    return "\n".join(
        (
            f"[{event.id}] beat={event.beat_id} lost={len(event.seats_lost)} "
            f"reason={event.reason_code} evidence={event.evidence.strip()}"
        )
        for event in drop_events
    )


def _audience_digest(reactions: list[AudienceReaction]) -> str:
    """Compact audience evidence, while the UI keeps every raw reaction."""
    by_beat: dict[int, list[AudienceReaction]] = {}
    for reaction in reactions:
        by_beat.setdefault(reaction.beat_id, []).append(reaction)

    lines: list[str] = []
    for beat_id, items in sorted(by_beat.items()):
        positive = sum(1 for item in items if item.delta > 0)
        negative = sum(1 for item in items if item.delta < 0)
        examples = sorted(items, key=lambda item: (-abs(item.delta), item.cohort))[:2]
        quotes = " | ".join(
            f'{item.cohort}: "{item.text}"' for item in examples
        )
        lines.append(f"[beat {beat_id}] +{positive} / -{negative} — {quotes}")
    return "\n".join(lines) or "No audience reactions were available."


async def run_expert(
    agent_id: AgentId,
    raw_text: str,
    beats: list[Beat],
    drop_events: list[DropEvent],
    llm: LLM | None = None,
    id_offset: int = 0,
    audience_reactions: list[AudienceReaction] | None = None,
) -> list[Note]:
    active_llm = get_llm() if llm is None else llm
    response = await active_llm.structured(
        prompt=expert.build_prompt(
            agent_id,
            raw_text,
            beats_digest(beats),
            _drops_digest(drop_events),
            _audience_digest(audience_reactions or []),
        ),
        schema=ExpertNoteDraftList,
        model=config.MODEL_EXPERT,
        system=expert.build_system(),
    )

    valid_beat_ids = {beat.id for beat in beats}
    allowed_note_types = set(NOTE_TYPES_BY_AGENT[agent_id])
    drop_by_beat = {
        event.beat_id: event.id
        for event in reversed(drop_events)
        if event.beat_id in valid_beat_ids
    }
    notes: list[Note] = []

    for draft in response.notes:
        if draft.beat_id not in valid_beat_ids:
            continue
        if draft.note_type not in allowed_note_types:
            continue
        if not draft.text.strip():
            continue

        notes.append(
            Note(
                id=f"n_{id_offset + len(notes) + 1:02d}",
                agent_id=agent_id,
                beat_id=draft.beat_id,
                anchored_to_drop=drop_by_beat.get(draft.beat_id),
                note_type=draft.note_type,
                note_label=NOTE_LABELS[draft.note_type],
                text=draft.text.strip(),
                evidence=draft.evidence.strip(),
                severity=draft.severity,
            )
        )
    return notes


def _stance(note_type: NoteType) -> str:
    """Where a note sits on the cut-versus-keep axis.

    "off_axis" is a real third answer, not a fallback. The Director asking
    whether a beat can be staged and the Psychologist asking whether a person
    would behave that way are not arguing about whether to cut it — they are
    observing a different dimension entirely.
    """
    if note_type in ATTACKING_NOTE_TYPES:
        return "attack"
    if note_type in DEFENDING_NOTE_TYPES:
        return "defend"
    return "off_axis"


def _relation(first: NoteType, second: NoteType) -> str:
    """agree | disagree | unrelated."""
    a, b = _stance(first), _stance(second)
    if a == "off_axis" or b == "off_axis":
        # Treating these as agreement is how the room ends up claiming the
        # Director endorsed a cut he never weighed in on — and, worse, agreeing
        # with the Editor and the Historian at once while those two disagree
        # with each other. Sharing a beat is not the same as sharing a view.
        return "unrelated"
    return "agree" if a == b else "disagree"


def _populate_relationships(
    notes: list[Note], drop_events: list[DropEvent]
) -> list[Note]:
    drop_beat_ids = {event.beat_id for event in drop_events}
    populated: list[Note] = []

    for note in notes:
        peers = [
            peer
            for peer in notes
            if peer.beat_id == note.beat_id and peer.agent_id != note.agent_id
        ]
        disagrees = set()
        agrees = set()
        for peer in peers:
            relation = _relation(note.note_type, peer.note_type)
            if relation == "disagree":
                disagrees.add(peer.agent_id.value)
            elif relation == "agree":
                agrees.add(peer.agent_id.value)

        # The audience is not on the cut-versus-keep axis either — it only
        # reports that it left. A note that argues the material earns its
        # place is contradicted by people walking out on it.
        if note.beat_id in drop_beat_ids:
            stance = _stance(note.note_type)
            if stance == "defend":
                disagrees.add("audience")
            elif stance == "attack":
                agrees.add("audience")
            # Off-axis notes stay off-axis here too. The Director flagging
            # unclear blocking on a beat people walked out of has not thereby
            # endorsed the walkout — same reason he does not endorse the
            # Editor's cut.

        populated.append(
            note.model_copy(
                update={
                    "agrees_with": sorted(agrees),
                    "disagrees_with": sorted(disagrees),
                }
            )
        )
    return populated


def _dropped_warning(agent_ids: list[AgentId]) -> Warning:
    agents = ", ".join(agent_id.value for agent_id in agent_ids)
    return Warning(
        code="EXPERT_DROPPED",
        message=f"Writers-room critics unavailable: {agents}.",
    )


async def convene_room(
    raw_text: str,
    beats: list[Beat],
    drop_events: list[DropEvent],
    llm: LLM | None = None,
    audience_reactions: list[AudienceReaction] | None = None,
) -> tuple[list[Note], list[Warning]]:
    try:
        active_llm = get_llm() if llm is None else llm
        results = await gather_structured(
            run_expert(
                agent_id,
                raw_text,
                beats,
                drop_events,
                active_llm,
                audience_reactions=audience_reactions,
            )
            for agent_id in AGENT_IDS
        )
    except Exception:
        return [], [_dropped_warning(list(AGENT_IDS))]

    failed = [
        agent_id
        for agent_id, result in zip(AGENT_IDS, results)
        if not result.ok
    ]
    notes = [
        note
        for result in results
        if result.ok and result.value is not None
        for note in result.value
    ]
    # Renumber across all five agents here — run_expert cannot know how many
    # notes its peers filed, so its per-agent ids are provisional. Width grows
    # past 99 rather than silently dropping the zero padding.
    width = max(2, len(str(len(notes))))
    notes = [
        note.model_copy(update={"id": f"n_{index + 1:0{width}d}"})
        for index, note in enumerate(notes)
    ]
    warnings = [_dropped_warning(failed)] if failed else []
    return _populate_relationships(notes, drop_events), warnings
