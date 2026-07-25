"""Regressions for defects found in review.

Each of these was a real bug that shipped and got caught reading the code
rather than running it. They stay tested so they do not come back.
"""

from __future__ import annotations

import pytest

import asyncio
from pathlib import Path

from app import config, pipeline, store
from app.models import (
    AgentId,
    Beat,
    BeatType,
    DropEvent,
    Note,
    Persona,
    NoteType,
)
from app.stages.a6_experts import _populate_relationships, _relation
from app.stages.a8_fix import classify_change


@pytest.fixture(autouse=True)
def isolated_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Never write to the real run store.

    This file drives the actual pipeline, and without this it persisted test
    runs into api/.runs — which wiped the pinned demo runs while leaving
    pinned.json pointing at them. At hour 20 that is the demo silently losing
    its insurance.
    """
    monkeypatch.setattr(config, "RUNS_DIR", tmp_path)
    monkeypatch.setattr(config, "LLM_BACKEND", "fake")
    saved_runs = dict(store._runs)
    saved_pins = dict(store._pinned)
    store._runs.clear()
    store._pinned.clear()
    yield
    store._runs.clear()
    store._runs.update(saved_runs)
    store._pinned.clear()
    store._pinned.update(saved_pins)


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


# ── the fix validator ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "after",
    [
        [0, 2, 1, 3, 4],  # adjacent swap — one move, ambiguous which beat
        [1, 0, 2, 3, 4],
        [0, 4, 1, 2, 3],  # a long move
        [3, 0, 1, 2, 4],
    ],
)
def test_a_single_move_is_accepted_however_short(after: list[int]) -> None:
    """A minimal nudge is still one move.

    Requiring a unique candidate rejected every adjacent swap, so "move the
    reveal slightly earlier" — the kind of fix the room actually recommends —
    failed twice and took the fix path down with it.
    """
    assert classify_change([0, 1, 2, 3, 4], after) == "move"


def test_a_single_cut_is_accepted() -> None:
    assert classify_change([0, 1, 2, 3, 4], [0, 1, 3, 4]) == "cut"


@pytest.mark.parametrize(
    "after",
    [
        [0, 1, 2, 3, 4],  # nothing changed — a fix has to do something
        [4, 3, 2, 1, 0],  # wholesale rewrite
        [1, 0, 3, 2, 4],  # two moves
        [0, 1, 4],  # two cuts
        [0, 1, 1, 3, 4],  # duplicated id
    ],
)
def test_anything_larger_than_one_edit_is_rejected(after: list[int]) -> None:
    assert classify_change([0, 1, 2, 3, 4], after) == "invalid"


# ── the blindfold guard's resolution ──────────────────────────────────────


def test_a_short_leak_between_sample_points_is_still_caught() -> None:
    """The guard used to sample every 10th offset of a 40-char window.

    A leaked fragment only a little longer than the window could fall between
    two sample points and pass. That is the one failure the product cannot
    survive quietly, so the check is exhaustive now.
    """
    from app.blindfold import BlindfoldViolation, build_scorer_input

    beats = [
        Beat(
            id=i,
            index=i,
            start_sec=i * 10,
            end_sec=(i + 1) * 10,
            text_span=span,
            type=BeatType.exposition,
            tension_delta=0,
            stakes_level=2,
        )
        for i, span in enumerate(
            [
                "Meera sets the kettle down and does not look up at him.",
                "The neighbour's radio starts up, the same programme as ever.",
                "Posted eleven years ago to an address she has never lived at.",
            ]
        )
    ]
    persona = Persona(
        id="commuter",
        label="Tier-2 commuter",
        prompt="noisy",
    )

    # Exactly one window's worth of beat 2, offset by a single character.
    # Under the old step of 10 this matched no sample point at all and passed
    # silently: the shingle at offset 0 starts before the fragment, and the
    # one at offset 10 runs past its end. Verified as a real miss, not a
    # hypothetical one.
    leak = beats[2].text_span[1:41]
    beats[0].text_span += " " + leak

    with pytest.raises(BlindfoldViolation):
        build_scorer_input(beats, 0, persona)


# ── a leak is never a degradation ─────────────────────────────────────────


def test_a_blindfold_violation_kills_the_run_rather_than_dropping_a_cohort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The degradation policy must not swallow this one.

    score_one caught every non-cancellation exception and turned it into a
    dropped cohort. A BlindfoldViolation went the same way: one cohort lost,
    a mild warning, and a run that finishes and hands over a full set of
    confident numbers produced by a model that could see the ending. Worse
    than a crash, because nobody would notice.
    """
    from app.blindfold import BlindfoldViolation

    real = pipeline.a2_score.score_persona_verbose

    async def leaky(beats, persona, llm=None):
        if persona.id == "kitchen":
            raise BlindfoldViolation("beat 14 leaked into the prompt for beat 3")
        return await real(beats, persona, llm)

    monkeypatch.setattr(pipeline.a2_score, "score_persona_verbose", leaky)
    raw = (config.DATA_DIR / "hero_script.txt").read_text()
    run = asyncio.run(pipeline.analyse("run_leak_test", raw, "Leak"))

    assert run.status == "error"
    assert [w.code for w in run.warnings] == ["BLINDFOLD_VIOLATED"]
    assert "COHORT_DROPPED" not in {w.code for w in run.warnings}
    assert run.audience == []
