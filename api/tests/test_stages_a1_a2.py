from __future__ import annotations

import asyncio

from app.fakes import FakeLLM
from app.llm import LLMError
from app.models import Beat, BeatType, Persona, ScoredBeat
from app.stages.a1_parse import parse_beats
from app.stages.a2_score import score_persona, score_persona_verbose


def _run(coro):
    return asyncio.run(coro)


def _persona() -> Persona:
    return Persona(
        id="commuter",
        label="Tier-2 commuter",
        context="40 min two-wheeler, noisy",
        start_patience=6.0,
    )


def _beats(count: int = 8) -> list[Beat]:
    return [
        Beat(
            id=index,
            index=index,
            start_sec=index * 10,
            end_sec=(index + 1) * 10,
            text_span=f"DISTINCTIVE-{index:02d}-" + chr(65 + index) * 100,
            type=BeatType.conflict,
            tension_delta=1,
            stakes_level=3,
        )
        for index in range(count)
    ]


def test_parse_beats_computes_contiguous_monotonic_timings() -> None:
    raw_text = " ".join(
        f"Scene word {index}: Maya follows the station signal." for index in range(180)
    )
    beats = _run(parse_beats(raw_text, FakeLLM()))

    assert beats[0].start_sec == 0
    assert all(
        beat.end_sec == following.start_sec
        for beat, following in zip(beats, beats[1:])
    )
    assert all(
        beat.start_sec <= beat.end_sec
        for beat in beats
    )
    assert all(
        beat.end_sec <= following.end_sec
        for beat, following in zip(beats, beats[1:])
    )


def test_parse_beats_assigns_contiguous_zero_based_ids_and_indexes() -> None:
    beats = _run(parse_beats("A short script with enough words " * 30, FakeLLM()))

    assert [(beat.id, beat.index) for beat in beats] == [
        (index, index) for index in range(len(beats))
    ]


class _SpyLLM:
    def __init__(self) -> None:
        self._fake = FakeLLM()
        self.prompts: list[str] = []

    async def structured(self, *, prompt, schema, model, system=None):
        self.prompts.append(prompt)
        return await self._fake.structured(
            prompt=prompt, schema=schema, model=model, system=system
        )


def test_score_persona_never_sends_future_text_to_the_model() -> None:
    beats = _beats()
    spy = _SpyLLM()

    _run(score_persona(beats, _persona(), spy))

    assert len(spy.prompts) == len(beats)
    for index, prompt in enumerate(spy.prompts):
        for future in beats[index + 1 :]:
            assert future.text_span not in prompt


def test_score_persona_returns_one_ordered_delta_per_beat() -> None:
    beats = _beats()

    deltas = _run(score_persona(beats, _persona(), FakeLLM()))

    assert len(deltas) == len(beats)
    assert [delta.beat_id for delta in deltas] == [beat.id for beat in beats]


class _EveryThirdFailsLLM(FakeLLM):
    def __init__(self) -> None:
        self.calls = 0

    async def structured(self, *, prompt, schema, model, system=None):
        self.calls += 1
        if self.calls % 3 == 0:
            raise LLMError("transient scorer failure")
        return await super().structured(
            prompt=prompt, schema=schema, model=model, system=system
        )


def test_score_persona_degrades_each_failed_beat_independently() -> None:
    beats = _beats()
    deltas, degraded = _run(
        score_persona_verbose(beats, _persona(), _EveryThirdFailsLLM())
    )

    assert len(deltas) == len(beats)
    assert degraded == 2
    assert [(deltas[index].delta, deltas[index].reason_code, deltas[index].evidence) for index in (2, 5)] == [
        (0, "PACING_FLAT", ""),
        (0, "PACING_FLAT", ""),
    ]


class _InvalidReasonCodeLLM(FakeLLM):
    async def structured(self, *, prompt, schema, model, system=None):
        return ScoredBeat.model_construct(
            delta=-2,
            reason_code="TOTALLY_MADE_UP",
            evidence="invented code",
        )


def test_score_persona_replaces_an_invalid_reason_code() -> None:
    deltas, degraded = _run(
        score_persona_verbose(_beats(1), _persona(), _InvalidReasonCodeLLM())
    )

    assert degraded == 1
    assert deltas[0].model_dump() == {
        "beat_id": 0,
        "delta": 0,
        "reason_code": "PACING_FLAT",
        "evidence": "",
    }
