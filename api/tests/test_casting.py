"""Audience casting and its handoff to scoring and simulation."""

from __future__ import annotations

import asyncio
from statistics import mean

import pytest

from app.fakes import FakeLLM
from app.models import Beat, BeatType, Persona
from app.stages.a0_cast import SEATS_PER_PERSONA, spawn_audience
from app.stages.a2_score import score_persona
from app.stages.a3_simulate import simulate_population


_PERSONA_IDS = (
    "commuter",
    "kitchen",
    "night_rider",
    "metro_pro",
    "sleep",
    "diaspora",
)


def _personas() -> list[Persona]:
    return [
        Persona(
            id=persona_id,
            label=persona_id.replace("_", " ").title(),
            persona_type="commuter",
            prompt=(
                f"{persona_id} listens while occupied and wants a clear reason "
                "to keep following the story."
            ),
        )
        for persona_id in _PERSONA_IDS
    ]


def _beats() -> list[Beat]:
    spans = (
        "Meera hears three knocks behind the locked pantry and drops the brass key.",
        "Rajan unfolds a blue railway map marked with a town nobody will name.",
        "The silent telephone rings, displaying Meera's own number from eleven years ago.",
    )
    return [
        Beat(
            id=index,
            index=index,
            start_sec=index * 10,
            end_sec=(index + 1) * 10,
            text_span=span,
            type=BeatType.conflict,
            tension_delta=1,
            stakes_level=3,
        )
        for index, span in enumerate(spans)
    ]


def test_six_personas_fill_thirty_unique_seats() -> None:
    cast = spawn_audience(_personas())
    seats = list(range(len(cast)))

    assert len(cast) == 30
    assert seats == list(range(30))
    assert all(
        len(cast[index : index + SEATS_PER_PERSONA]) == SEATS_PER_PERSONA
        for index in range(0, len(cast), SEATS_PER_PERSONA)
    )


def test_casting_is_deterministic_even_when_personas_are_shuffled() -> None:
    personas = _personas()

    first = spawn_audience(personas)
    second = spawn_audience(personas)
    shuffled = spawn_audience(list(reversed(personas)))

    assert first == second
    assert first == shuffled
    assert {
        persona.id: list(
            range(
                index * SEATS_PER_PERSONA,
                (index + 1) * SEATS_PER_PERSONA,
            )
        )
        for index, (persona, _) in enumerate(first[::SEATS_PER_PERSONA])
    } == {
        persona.id: list(
            range(
                index * SEATS_PER_PERSONA,
                (index + 1) * SEATS_PER_PERSONA,
            )
        )
        for index, (persona, _) in enumerate(shuffled[::SEATS_PER_PERSONA])
    }


def test_patience_spread_is_strict_and_material() -> None:
    calibrations = [
        calibration
        for persona, calibration in spawn_audience(_personas())
        if persona.id == "commuter"
    ]
    patience = [calibration.start_patience for calibration in calibrations]

    assert patience == sorted(patience)
    assert all(left < right for left, right in zip(patience, patience[1:]))
    assert patience[-1] >= patience[0] * 1.4


def test_sensitive_early_bailer_notices_more_than_forgiving_stayer() -> None:
    calibrations = [
        calibration
        for persona, calibration in spawn_audience(_personas())
        if persona.id == "commuter"
    ]

    assert mean(calibrations[0].sensitivity.values()) > mean(
        calibrations[4].sensitivity.values()
    )


def test_five_personas_cannot_fill_the_theatre() -> None:
    with pytest.raises(ValueError, match="exactly 30 seats"):
        spawn_audience(_personas()[:5])


def test_fake_llm_score_to_simulation_produces_complete_audience() -> None:
    personas = _personas()
    cast = spawn_audience(personas)
    beats = _beats()

    async def score_all():
        return await asyncio.gather(
            *(score_persona(beats, persona, FakeLLM()) for persona in personas)
        )

    scored = asyncio.run(score_all())
    deltas = {
        persona.id: persona_deltas
        for persona, persona_deltas in zip(personas, scored)
    }
    audience = simulate_population(deltas, cast, beats)

    assert len(audience) == 30
    assert all(
        len(member.patience_trace) == len(beats) + 1
        for member in audience
    )
    assert all(member.persona_id for member in audience)
    assert {member.variant_index for member in audience} == set(range(5))
