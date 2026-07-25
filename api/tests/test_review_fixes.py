"""Regressions for defects found in review.

Each of these was a real bug that shipped and got caught reading the code
rather than running it. They stay tested so they do not come back.
"""

from __future__ import annotations

import pytest

from app import pipeline
from app.models import (
    AgentId,
    Beat,
    BeatType,
    DropEvent,
    Note,
    NoteType,
)
from app.stages.a6_experts import _populate_relationships, _relation


def _note(agent: AgentId, note_type: NoteType, beat_id: int = 1) -> Note:
    return Note(
        id=f"n_{agent.value[:2]}",
        agent_id=agent,
        beat_id=beat_id,
        note_type=note_type,
        note_label="x",
        text="x",
        evidence="x",
        severity=3,
    )


# ── the room's agree/disagree axis ────────────────────────────────────────


def test_cut_and_defend_disagree() -> None:
    assert _relation(NoteType.CUT_CANDIDATE, NoteType.DETAIL_UNGROUNDED) == "disagree"
    assert _relation(NoteType.DETAIL_UNGROUNDED, NoteType.CUT_CANDIDATE) == "disagree"


def test_same_side_agrees() -> None:
    assert _relation(NoteType.CUT_CANDIDATE, NoteType.SCENE_OVERLONG) == "agree"
    assert _relation(NoteType.DISTINCTIVE, NoteType.CULTURAL_MISFIT) == "agree"


def test_off_axis_notes_take_no_side() -> None:
    """The Director asking whether a beat can be staged is not endorsing a cut.

    Treating him as agreeing made him side with the Editor and the Historian
    at once, while those two disagree with each other.
    """
    assert _relation(NoteType.UNPLAYABLE_BEAT, NoteType.CUT_CANDIDATE) == "unrelated"
    assert _relation(NoteType.MOTIVATION_UNSUPPORTED, NoteType.DETAIL_UNGROUNDED) == "unrelated"


def test_director_does_not_endorse_a_cut_he_never_weighed_in_on() -> None:
    notes = _populate_relationships(
        [
            _note(AgentId.editor, NoteType.CUT_CANDIDATE),
            _note(AgentId.historian, NoteType.DETAIL_UNGROUNDED),
            _note(AgentId.director, NoteType.UNPLAYABLE_BEAT),
        ],
        [],
    )
    by_agent = {n.agent_id: n for n in notes}

    assert by_agent[AgentId.editor].disagrees_with == ["historian"]
    assert by_agent[AgentId.historian].disagrees_with == ["editor"]
    assert by_agent[AgentId.director].agrees_with == []
    assert by_agent[AgentId.director].disagrees_with == []


def test_nobody_both_agrees_and_disagrees_with_the_same_agent() -> None:
    notes = _populate_relationships(
        [
            _note(AgentId.editor, NoteType.MOVE_EARLIER),
            _note(AgentId.critic, NoteType.CLICHE),
            _note(AgentId.historian, NoteType.REGISTER_WRONG),
            _note(AgentId.psychologist, NoteType.EMOTIONAL_SKIP),
        ],
        [],
    )
    for note in notes:
        assert not set(note.agrees_with) & set(note.disagrees_with)


def test_walkouts_contradict_a_note_defending_the_material() -> None:
    drop = DropEvent(
        id="de_01",
        timestamp=10,
        beat_id=1,
        seats_lost=[1, 2],
        cohort_breakdown={"commuter": 2},
        reason_code="EXPOSITION_STACK",
        reason_label="Exposition stacking",
        evidence="x",
        kind="structural",
    )
    notes = _populate_relationships(
        [
            _note(AgentId.critic, NoteType.DISTINCTIVE),
            _note(AgentId.editor, NoteType.CUT_CANDIDATE),
        ],
        [drop],
    )
    by_agent = {n.agent_id: n for n in notes}

    # People walked out of the thing the Critic says earns its place.
    assert "audience" in by_agent[AgentId.critic].disagrees_with
    assert "audience" in by_agent[AgentId.editor].agrees_with


# ── cohort selection ──────────────────────────────────────────────────────


def test_empty_cohort_ids_screens_to_everyone_not_to_nobody() -> None:
    """An empty list is not a request for an empty hall."""
    assert len(pipeline._load_personas([])) == 6
    assert len(pipeline._load_personas(None)) == 6


def test_selecting_a_subset_works() -> None:
    picked = pipeline._load_personas(["commuter", "sleep"])
    assert {p.id for p in picked} == {"commuter", "sleep"}


def test_entirely_unknown_cohorts_are_an_error_not_an_empty_hall() -> None:
    with pytest.raises(ValueError):
        pipeline._load_personas(["not_a_cohort"])
