"""The contract. Everything renders from this.

Contract version 1.0. Any change to a field here requires all three track
owners present — announce it, change it, push, then implement. A field
changed unilaterally at hour 18 costs more than the feature it enabled.

The build list says "chunk"/"walkout"/"cause"; the wire contract says
"beat"/"drop_event"/"reason_code". The wire contract wins — Track B renders
from these names.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

# ══════════════════════════════════════════════════════════════════════════
# CLOSED VOCABULARIES
# The scorer and the critics may only emit codes from these lists. They are
# enums, not strings, so a hallucinated code fails schema validation rather
# than reaching the UI.
# ══════════════════════════════════════════════════════════════════════════


class DrainCode(str, Enum):
    """Ten ways a beat burns attention."""

    EXPOSITION_STACK = "EXPOSITION_STACK"
    NO_OPEN_QUESTION = "NO_OPEN_QUESTION"
    TROPE_FATIGUE = "TROPE_FATIGUE"
    CHARACTER_OVERLOAD = "CHARACTER_OVERLOAD"
    UNCLEAR_POV = "UNCLEAR_POV"
    STAKES_TOO_LOW = "STAKES_TOO_LOW"
    PACING_FLAT = "PACING_FLAT"
    PAYOFF_TOO_FAR = "PAYOFF_TOO_FAR"
    TONAL_WHIPLASH = "TONAL_WHIPLASH"
    DIALOGUE_UNVOICED = "DIALOGUE_UNVOICED"


class RefillCode(str, Enum):
    """Seven ways a beat refills attention."""

    QUESTION_OPENED = "QUESTION_OPENED"
    STAKES_ESCALATED = "STAKES_ESCALATED"
    NOVEL_PREMISE = "NOVEL_PREMISE"
    EMOTIONAL_HIT = "EMOTIONAL_HIT"
    TENSION_SPIKE = "TENSION_SPIKE"
    TROPE_HIT = "TROPE_HIT"
    VOICE_DISTINCTIVE = "VOICE_DISTINCTIVE"


DRAIN_CODES: tuple[str, ...] = tuple(c.value for c in DrainCode)
REFILL_CODES: tuple[str, ...] = tuple(c.value for c in RefillCode)
ALL_REASON_CODES: tuple[str, ...] = DRAIN_CODES + REFILL_CODES


def is_drain(code: str) -> bool:
    return code in DRAIN_CODES


class BeatType(str, Enum):
    setup = "setup"
    exposition = "exposition"
    conflict = "conflict"
    reveal = "reveal"
    banter = "banter"
    action = "action"
    cliffhanger = "cliffhanger"


class AgentId(str, Enum):
    director = "director"
    editor = "editor"
    critic = "critic"
    psychologist = "psychologist"
    historian = "historian"


class NoteType(str, Enum):
    # director
    UNPLAYABLE_BEAT = "UNPLAYABLE_BEAT"
    NO_VISUAL_ANCHOR = "NO_VISUAL_ANCHOR"
    BLOCKING_UNCLEAR = "BLOCKING_UNCLEAR"
    TONE_UNDIRECTED = "TONE_UNDIRECTED"
    # editor
    CUT_CANDIDATE = "CUT_CANDIDATE"
    MOVE_EARLIER = "MOVE_EARLIER"
    SCENE_OVERLONG = "SCENE_OVERLONG"
    ENTRY_TOO_LATE = "ENTRY_TOO_LATE"
    # critic
    CLICHE = "CLICHE"
    DERIVATIVE_STRUCTURE = "DERIVATIVE_STRUCTURE"
    UNEARNED_TURN = "UNEARNED_TURN"
    DISTINCTIVE = "DISTINCTIVE"
    # psychologist
    MOTIVATION_UNSUPPORTED = "MOTIVATION_UNSUPPORTED"
    EMOTIONAL_SKIP = "EMOTIONAL_SKIP"
    INCONSISTENT_BEHAVIOUR = "INCONSISTENT_BEHAVIOUR"
    RELATIONSHIP_UNGROUNDED = "RELATIONSHIP_UNGROUNDED"
    # historian
    PERIOD_INCONSISTENT = "PERIOD_INCONSISTENT"
    CULTURAL_MISFIT = "CULTURAL_MISFIT"
    REGISTER_WRONG = "REGISTER_WRONG"
    DETAIL_UNGROUNDED = "DETAIL_UNGROUNDED"


#: Each critic may only file its own note types. Enforced in a6_experts.py —
#: a note outside its agent's set is dropped before it leaves the module.
NOTE_TYPES_BY_AGENT: dict[AgentId, tuple[NoteType, ...]] = {
    AgentId.director: (
        NoteType.UNPLAYABLE_BEAT,
        NoteType.NO_VISUAL_ANCHOR,
        NoteType.BLOCKING_UNCLEAR,
        NoteType.TONE_UNDIRECTED,
    ),
    AgentId.editor: (
        NoteType.CUT_CANDIDATE,
        NoteType.MOVE_EARLIER,
        NoteType.SCENE_OVERLONG,
        NoteType.ENTRY_TOO_LATE,
    ),
    AgentId.critic: (
        NoteType.CLICHE,
        NoteType.DERIVATIVE_STRUCTURE,
        NoteType.UNEARNED_TURN,
        NoteType.DISTINCTIVE,
    ),
    AgentId.psychologist: (
        NoteType.MOTIVATION_UNSUPPORTED,
        NoteType.EMOTIONAL_SKIP,
        NoteType.INCONSISTENT_BEHAVIOUR,
        NoteType.RELATIONSHIP_UNGROUNDED,
    ),
    AgentId.historian: (
        NoteType.PERIOD_INCONSISTENT,
        NoteType.CULTURAL_MISFIT,
        NoteType.REGISTER_WRONG,
        NoteType.DETAIL_UNGROUNDED,
    ),
}

COHORT_IDS: tuple[str, ...] = (
    "commuter",
    "kitchen",
    "night_rider",
    "metro_pro",
    "sleep",
    "diaspora",
)


# ══════════════════════════════════════════════════════════════════════════
# STAGE TYPES
# ══════════════════════════════════════════════════════════════════════════


class Beat(BaseModel):
    """One numbered chunk of script. A1 produces these; everything is anchored
    to `id`."""

    id: int
    index: int
    start_sec: int
    end_sec: int
    text_span: str
    type: BeatType
    tension_delta: int = Field(ge=-3, le=3)
    questions_opened: list[str] = Field(default_factory=list)
    questions_closed: list[str] = Field(default_factory=list)
    characters_present: list[str] = Field(default_factory=list)
    stakes_level: int = Field(ge=1, le=5)


class BeatDraft(BaseModel):
    """What the model is actually asked for in A1.

    Deliberately *not* a Beat: timings are arithmetic and are computed in
    Python from cumulative word count, never asked of the model.
    """

    text_span: str
    type: BeatType
    tension_delta: int = Field(ge=-3, le=3)
    questions_opened: list[str] = Field(default_factory=list)
    questions_closed: list[str] = Field(default_factory=list)
    characters_present: list[str] = Field(default_factory=list)
    stakes_level: int = Field(ge=1, le=5)


class BeatDraftList(BaseModel):
    beats: list[BeatDraft]


class Persona(BaseModel):
    """A listener cohort. Track C ships calibrated versions of these at hour
    13; we run on committed placeholders until then, with no code change."""

    id: str
    label: str
    context: str
    start_patience: float
    #: reason_code -> multiplier. How hard this cohort takes each drain cause.
    sensitivity: dict[str, float] = Field(default_factory=dict)
    #: reason_code -> multiplier. How much each refill cause helps them.
    replenish: dict[str, float] = Field(default_factory=dict)
    seat_count: int = 5
    #: Number of real abandonment statements behind this persona. 0 until
    #: Track C mines the corpus. Surfaced in the UI — it is the grounding
    #: claim made visible.
    calibrated_from: int = 0


class AttentionDelta(BaseModel):
    """One blinded judgement about one beat. A bounded quantity, one code from
    a closed list, and a phrase quoted from that beat — never a verdict."""

    beat_id: int
    delta: int = Field(ge=-3, le=3)
    reason_code: str
    evidence: str


class ScoredBeat(BaseModel):
    """The exact shape asked of the scorer for a single beat."""

    delta: int = Field(ge=-3, le=3)
    reason_code: str
    evidence: str


class AudienceMember(BaseModel):
    """One of the thirty. Individual fate, individual reason."""

    seat: int = Field(ge=0, le=29)
    cohort: str
    name: str
    start_patience: float
    #: None means they stayed to the end. Not 0, not -1.
    left_at_sec: int | None = None
    left_at_beat: int | None = None
    reason_code: str | None = None
    reason_label: str | None = None
    evidence: str | None = None
    #: Length is always len(beats) + 1. Index 0 is starting patience.
    patience_trace: list[float] = Field(default_factory=list)


class DropEvent(BaseModel):
    """A moment where a group left, and what kind of problem it was."""

    id: str
    timestamp: int
    beat_id: int
    seats_lost: list[int]
    cohort_breakdown: dict[str, int]
    reason_code: str
    reason_label: str
    evidence: str
    #: "structural" — leavers span cohorts, the writing is broken there.
    #: "taste_split" — one cohort left while another sailed through.
    kind: Literal["structural", "taste_split"]


class Note(BaseModel):
    """An expert's note. Anchored to a beat or it does not exist."""

    id: str
    agent_id: AgentId
    #: Required. A note without this is invalid and must not be emitted.
    beat_id: int
    anchored_to_drop: str | None = None
    note_type: NoteType
    note_label: str
    text: str
    evidence: str
    severity: int = Field(ge=1, le=5)
    agrees_with: list[str] = Field(default_factory=list)
    disagrees_with: list[str] = Field(default_factory=list)


class Consensus(BaseModel):
    beat_id: int
    claim: str
    agents: list[str]


class Position(BaseModel):
    agents: list[str]
    claim: str


class Conflict(BaseModel):
    beat_id: int
    position_a: Position
    position_b: Position


class RoomSynthesis(BaseModel):
    consensus: list[Consensus] = Field(default_factory=list)
    conflict: list[Conflict] = Field(default_factory=list)
    recommended_fix: str
    predicted_seats_saved: int


# ══════════════════════════════════════════════════════════════════════════
# THE RUN OBJECT — the central contract
# ══════════════════════════════════════════════════════════════════════════


class ScriptMeta(BaseModel):
    id: str
    title: str
    duration_sec: int
    word_count: int


class Cohort(BaseModel):
    id: str
    label: str
    context: str
    seat_count: int
    retained_pct: float


class AgentMeta(BaseModel):
    id: str
    label: str
    lens: str


class Summary(BaseModel):
    retained_pct: float
    seats_total: int
    seats_retained: int
    biggest_cliff_sec: int | None = None
    cohort_retention: dict[str, float] = Field(default_factory=dict)


class Audio(BaseModel):
    before_url: str | None = None
    after_url: str | None = None
    section_start_sec: int | None = None
    section_end_sec: int | None = None


class Warning(BaseModel):
    code: str
    message: str


class Run(BaseModel):
    """Everything the UI renders comes from this object and nothing else."""

    contract_version: str = "1.0"
    run_id: str
    parent_run_id: str | None = None
    variant: Literal["original", "fixed"] = "original"
    status: Literal["analysing", "ready", "error"] = "analysing"
    created_at: str

    script: ScriptMeta
    beats: list[Beat] = Field(default_factory=list)
    cohorts: list[Cohort] = Field(default_factory=list)
    audience: list[AudienceMember] = Field(default_factory=list)
    drop_events: list[DropEvent] = Field(default_factory=list)
    agents: list[AgentMeta] = Field(default_factory=list)
    notes: list[Note] = Field(default_factory=list)
    room_synthesis: RoomSynthesis | None = None
    summary: Summary | None = None
    audio: Audio | None = None
    #: Every degradation appends here. Never blocks render.
    warnings: list[Warning] = Field(default_factory=list)


# ══════════════════════════════════════════════════════════════════════════
# PROGRESS — the exact copy Track B renders. Do not paraphrase.
# ══════════════════════════════════════════════════════════════════════════


class Stage(str, Enum):
    QUEUED = "QUEUED"
    PARSING_BEATS = "PARSING_BEATS"
    SEATING_AUDIENCE = "SEATING_AUDIENCE"
    SCREENING = "SCREENING"
    CONVENING_ROOM = "CONVENING_ROOM"
    SYNTHESISING = "SYNTHESISING"
    READY = "READY"
    ERROR = "ERROR"


STAGE_MESSAGE: dict[Stage, str] = {
    Stage.QUEUED: "Opening the hall",
    Stage.PARSING_BEATS: "Reading the script",
    Stage.SEATING_AUDIENCE: "Seating thirty listeners",
    Stage.SCREENING: "Simulating 30 listeners",
    Stage.CONVENING_ROOM: "The room is watching",
    Stage.SYNTHESISING: "Comparing notes",
    Stage.READY: "",
    Stage.ERROR: "",
}


class Progress(BaseModel):
    stage: Stage
    message: str
    pct: int = Field(ge=0, le=100)
    beats_total: int = 0
    beats_done: int = 0


class RunStatus(BaseModel):
    """What GET /runs/{id} returns while still analysing."""

    run_id: str
    status: Literal["analysing", "ready", "error"]
    progress: Progress | None = None
