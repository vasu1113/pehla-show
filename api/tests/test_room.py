from __future__ import annotations

import asyncio

import pytest

from app.fakes import FakeLLM
from app.llm import LLMError
from app.models import (
    AgentId,
    Beat,
    BeatType,
    DropEvent,
    Note,
    NoteType,
)
from app.stages.a6_experts import convene_room, run_expert
from app.stages.a7_synth import synthesise_room
from app.stages.a8_fix import apply_fix, classify_change


def _run(coro):
    return asyncio.run(coro)


def _beats(count: int = 4) -> list[Beat]:
    word_counts = [5, 10, 15, 20]
    return [
        Beat(
            id=index,
            index=index,
            start_sec=index * 4,
            end_sec=(index + 1) * 4,
            text_span=" ".join(
                f"beat-{index}-word-{word}" for word in range(word_counts[index])
            ),
            type=BeatType.conflict,
            tension_delta=1,
            stakes_level=3,
        )
        for index in range(count)
    ]


def _drop(beat_id: int = 1) -> DropEvent:
    return DropEvent(
        id="de_01",
        timestamp=4,
        beat_id=beat_id,
        seats_lost=[1, 2],
        cohort_breakdown={"commuter": 2},
        reason_code="PACING_FLAT",
        reason_label="Pacing flat",
        evidence="The scene stalls.",
        kind="taste_split",
    )


def _draft(
    beat_id: int = 1,
    note_type: NoteType = NoteType.CUT_CANDIDATE,
    text: str = "Cut this beat.",
) -> dict[str, object]:
    return {
        "beat_id": beat_id,
        "note_type": note_type,
        "text": text,
        "evidence": "The scene stalls.",
        "severity": 4,
    }


class _DraftLLM(FakeLLM):
    def __init__(self, drafts: list[dict[str, object]]) -> None:
        self.drafts = drafts
        self.prompts: list[str] = []

    async def structured(self, *, prompt, schema, model, system=None):
        self.prompts.append(prompt)
        return schema.model_validate({"notes": self.drafts})


def test_run_expert_drops_a_note_for_a_nonexistent_beat() -> None:
    llm = _DraftLLM([_draft(beat_id=99)])

    notes = _run(
        run_expert(AgentId.editor, "FULL SCRIPT", _beats(), [_drop()], llm)
    )

    assert notes == []
    assert "FULL SCRIPT" in llm.prompts[0]


def test_run_expert_drops_a_note_owned_by_another_agent() -> None:
    llm = _DraftLLM([_draft(note_type=NoteType.CLICHE)])

    notes = _run(
        run_expert(AgentId.editor, "FULL SCRIPT", _beats(), [_drop()], llm)
    )

    assert notes == []


_NOTE_TYPE_BY_AGENT = {
    AgentId.director: NoteType.NO_VISUAL_ANCHOR,
    AgentId.editor: NoteType.CUT_CANDIDATE,
    AgentId.critic: NoteType.CLICHE,
    AgentId.psychologist: NoteType.EMOTIONAL_SKIP,
    AgentId.historian: NoteType.PERIOD_INCONSISTENT,
}


class _RoomLLM(FakeLLM):
    def __init__(self, failures: set[AgentId] | None = None) -> None:
        self.failures = failures or set()

    async def structured(self, *, prompt, schema, model, system=None):
        agent_id = next(
            agent
            for agent in AgentId
            if f"YOU ARE THE {agent.value.upper()}" in prompt
        )
        if agent_id in self.failures:
            raise LLMError(f"{agent_id.value} failed")
        return schema.model_validate(
            {"notes": [_draft(note_type=_NOTE_TYPE_BY_AGENT[agent_id])]}
        )


def test_convene_room_keeps_four_critics_when_one_fails() -> None:
    notes, warnings = _run(
        convene_room(
            "script",
            _beats(),
            [_drop()],
            _RoomLLM({AgentId.critic}),
        )
    )

    assert len(notes) == 4
    assert {note.agent_id for note in notes} == set(AgentId) - {AgentId.critic}
    assert len(warnings) == 1
    assert warnings[0].code == "EXPERT_DROPPED"


def test_convene_room_degrades_when_all_five_critics_fail() -> None:
    notes, warnings = _run(
        convene_room("script", _beats(), [_drop()], _RoomLLM(set(AgentId)))
    )

    assert notes == []
    assert len(warnings) == 1
    assert warnings[0].code == "EXPERT_DROPPED"


def test_convene_room_assigns_unique_note_ids_across_agents() -> None:
    notes, warnings = _run(
        convene_room("script", _beats(), [_drop()], _RoomLLM())
    )

    assert warnings == []
    assert [note.id for note in notes] == [
        "n_01",
        "n_02",
        "n_03",
        "n_04",
        "n_05",
    ]
    assert len({note.id for note in notes}) == 5


@pytest.mark.parametrize(
    ("before", "after"),
    [
        ([0, 1, 2, 3], [0, 2, 3, 1]),
        ([0, 1, 2, 3], [3, 0, 1, 2]),
    ],
)
def test_classify_change_recognises_a_single_move(
    before: list[int], after: list[int]
) -> None:
    assert classify_change(before, after) == "move"


def test_classify_change_recognises_a_single_cut() -> None:
    assert classify_change([0, 1, 2, 3], [0, 2, 3]) == "cut"


@pytest.mark.parametrize(
    ("before", "after"),
    [
        ([0, 1, 2, 3], [0, 2, 1, 3]),
        ([0, 1, 2, 3], [0, 1, 1, 3]),
        ([0, 1, 2, 3], [8, 9]),
    ],
)
def test_classify_change_rejects_nonminimal_changes(
    before: list[int], after: list[int]
) -> None:
    assert classify_change(before, after) == "invalid"


class _OrderLLM(FakeLLM):
    def __init__(self, order: list[int]) -> None:
        self.order = order
        self.calls = 0

    async def structured(self, *, prompt, schema, model, system=None):
        self.calls += 1
        return schema.model_validate({"order": self.order})


def test_apply_fix_recomputes_contiguous_timings_after_a_move() -> None:
    original = _beats()
    fixed = _run(
        apply_fix(original, "Move beat 1 later.", _OrderLLM([0, 2, 3, 1]))
    )

    assert [beat.id for beat in fixed] == [0, 2, 3, 1]
    assert [beat.index for beat in fixed] == [0, 1, 2, 3]
    assert fixed[0].start_sec == 0
    assert all(
        beat.end_sec == following.start_sec
        for beat, following in zip(fixed, fixed[1:])
    )
    assert {beat.id for beat in fixed} == {beat.id for beat in original}


def test_apply_fix_retries_then_rejects_a_wholesale_rewrite() -> None:
    llm = _OrderLLM([2, 3, 0, 1])

    with pytest.raises(LLMError):
        _run(apply_fix(_beats(), "Rewrite everything.", llm))

    assert llm.calls == 2


def _note(beat_id: int = 1) -> Note:
    return Note(
        id="n_01",
        agent_id=AgentId.editor,
        beat_id=beat_id,
        note_type=NoteType.CUT_CANDIDATE,
        note_label="Cut candidate",
        text="Cut this beat.",
        evidence="The scene stalls.",
        severity=4,
    )


class _SynthesisLLM(FakeLLM):
    async def structured(self, *, prompt, schema, model, system=None):
        return schema.model_validate(
            {
                "consensus": [
                    {"beat_id": 1, "claim": "It drags.", "agents": ["editor"]},
                    {"beat_id": 99, "claim": "Invented.", "agents": ["critic"]},
                ],
                "conflict": [
                    {
                        "beat_id": 1,
                        "position_a": {
                            "agents": ["editor"],
                            "claim": "Cut it.",
                        },
                        "position_b": {
                            "agents": ["historian"],
                            "claim": "Keep it.",
                        },
                    },
                    {
                        "beat_id": 99,
                        "position_a": {"agents": [], "claim": "Invented."},
                        "position_b": {"agents": [], "claim": "Invented."},
                    },
                ],
                "recommended_fix": "Cut chunk 1.",
                "predicted_seats_saved": 2,
            }
        )


def test_synthesise_room_drops_entries_for_unknown_beats() -> None:
    result = _run(synthesise_room([_note()], [_drop()], 2, _SynthesisLLM()))

    assert result is not None
    assert [item.beat_id for item in result.consensus] == [1]
    assert [item.beat_id for item in result.conflict] == [1]


class _FailingSynthesisLLM(FakeLLM):
    async def structured(self, *, prompt, schema, model, system=None):
        raise LLMError("synthesis unavailable")


def test_synthesise_room_returns_none_on_failure() -> None:
    assert (
        _run(
            synthesise_room(
                [_note()],
                [_drop()],
                2,
                _FailingSynthesisLLM(),
            )
        )
        is None
    )
