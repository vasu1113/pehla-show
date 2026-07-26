from __future__ import annotations

from app import config
from app.llm import LLM, get_llm
from app.models import AudienceReaction, DropEvent, Note, RoomSynthesis
from app.prompts import synthesis


def _notes_digest(notes: list[Note]) -> str:
    return "\n".join(
        (
            f"[{note.id}] beat={note.beat_id} {note.agent_id.value}/"
            f"{note.note_type.value} severity={note.severity}: "
            f"{' '.join(note.text.split())}"
        )
        for note in notes
    )


def _drops_digest(drop_events: list[DropEvent]) -> str:
    return "\n".join(
        (
            f"[{event.id}] beat={event.beat_id} lost={len(event.seats_lost)} "
            f"{event.reason_code}: {' '.join(event.evidence.split())}"
        )
        for event in drop_events
    )


def _audience_digest(reactions: list[AudienceReaction]) -> str:
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


async def synthesise_room(
    notes: list[Note],
    drop_events: list[DropEvent],
    seats_lost: int,
    llm: LLM | None = None,
    audience_reactions: list[AudienceReaction] | None = None,
) -> RoomSynthesis | None:
    try:
        active_llm = get_llm() if llm is None else llm
        result = await active_llm.structured(
            prompt=synthesis.build_prompt(
                _notes_digest(notes),
                _drops_digest(drop_events),
                _audience_digest(audience_reactions or []),
                seats_lost,
            ),
            schema=RoomSynthesis,
            model=config.MODEL_SYNTH,
            system=synthesis.build_system(),
        )
    except Exception:
        return None

    valid_beat_ids = {
        note.beat_id for note in notes
    } | {
        event.beat_id for event in drop_events
    }
    return result.model_copy(
        update={
            "consensus": [
                item
                for item in result.consensus
                if item.beat_id in valid_beat_ids
            ],
            "conflict": [
                item
                for item in result.conflict
                if item.beat_id in valid_beat_ids
            ],
        }
    )
