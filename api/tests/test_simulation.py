"""Arithmetic-only tests for audience simulation and cliff detection."""

from __future__ import annotations

from app.models import (
    AttentionDelta,
    AudienceMember,
    Beat,
    BeatType,
    Persona,
)
from app.stages.a3_simulate import simulate_population
from app.stages.a4_cliffs import detect_cliffs


_COHORTS = (
    "commuter",
    "kitchen",
    "night_rider",
    "metro_pro",
    "sleep",
    "diaspora",
)


def _beats() -> list[Beat]:
    return [
        Beat(
            id=index,
            index=index,
            start_sec=index * 10,
            end_sec=(index + 1) * 10,
            text_span=f"Synthetic beat {index}",
            type=BeatType.conflict,
            tension_delta=0,
            stakes_level=2,
        )
        for index in range(6)
    ]


def _personas() -> list[Persona]:
    return [
        Persona(
            id=cohort,
            label=cohort.replace("_", " ").title(),
            context="Synthetic listening context",
            start_patience=2.0,
            sensitivity={"PACING_FLAT": 1.0},
            replenish={"TENSION_SPIKE": 1.0},
        )
        for cohort in _COHORTS
    ]


def _deltas() -> dict[str, list[AttentionDelta]]:
    return {
        cohort: [
            AttentionDelta(
                beat_id=beat.id,
                delta=-3 if cohort == "commuter" else 3,
                reason_code=(
                    "PACING_FLAT" if cohort == "commuter" else "TENSION_SPIKE"
                ),
                evidence=beat.text_span,
            )
            for beat in _beats()
        ]
        for cohort in _COHORTS
    }


def _simulated_audience() -> list[AudienceMember]:
    return simulate_population(_deltas(), _personas(), _beats())


def test_simulation_is_deterministic_even_when_personas_are_shuffled() -> None:
    beats, personas, deltas = _beats(), _personas(), _deltas()

    first = simulate_population(deltas, personas, beats)
    second = simulate_population(deltas, personas, beats)
    shuffled = simulate_population(deltas, list(reversed(personas)), beats)

    assert first == second
    assert first == shuffled


def test_every_member_has_one_trace_entry_per_beat_plus_start() -> None:
    beats = _beats()
    audience = simulate_population(_deltas(), _personas(), beats)

    assert all(
        len(member.patience_trace) == len(beats) + 1
        for member in audience
    )


def test_population_has_exactly_thirty_unique_numbered_seats() -> None:
    audience = _simulated_audience()

    assert len(audience) == 30
    assert sorted(member.seat for member in audience) == list(range(30))


def test_negative_listener_leaves_and_positive_listener_stays() -> None:
    audience = _simulated_audience()
    negative_listener = next(
        member for member in audience if member.cohort == "commuter"
    )
    positive_listener = next(
        member for member in audience if member.cohort == "kitchen"
    )

    assert negative_listener.left_at_sec is not None
    assert positive_listener.left_at_sec is None


def test_exit_metadata_is_never_half_populated() -> None:
    leavers = [
        member for member in _simulated_audience()
        if member.left_at_sec is not None
    ]

    assert leavers
    assert all(
        member.left_at_beat is not None
        and member.reason_code is not None
        and member.reason_label is not None
        and member.evidence is not None
        for member in leavers
    )
    assert all(member.left_at_sec is None or member.left_at_sec >= 0 for member in leavers)


def _leaver(
    seat: int,
    cohort: str,
    timestamp: int,
    beat_id: int,
) -> AudienceMember:
    return AudienceMember(
        seat=seat,
        cohort=cohort,
        name=f"Synthetic listener {seat}",
        start_patience=2.0,
        left_at_sec=timestamp,
        left_at_beat=beat_id,
        reason_code="PACING_FLAT",
        reason_label="Flat pacing",
        evidence="The scene did not turn.",
        patience_trace=[2.0, 0.0],
    )


def test_cliffs_classify_structural_and_taste_split_windows() -> None:
    audience = [
        _leaver(0, "commuter", 11, 1),
        _leaver(1, "kitchen", 12, 1),
        _leaver(2, "night_rider", 13, 1),
        _leaver(3, "metro_pro", 14, 1),
        _leaver(4, "sleep", 31, 3),
        _leaver(5, "sleep", 35, 3),
    ]

    events = detect_cliffs(audience, _beats())

    assert [event.id for event in events] == ["de_01", "de_02"]
    assert events[0].kind == "structural"
    assert events[0].cohort_breakdown == {
        "commuter": 1,
        "kitchen": 1,
        "metro_pro": 1,
        "night_rider": 1,
    }
    assert events[1].kind == "taste_split"
    assert events[1].cohort_breakdown == {"sleep": 2}


def test_single_walkout_window_is_not_a_cliff() -> None:
    audience = [_leaver(0, "commuter", 21, 2)]

    assert detect_cliffs(audience, _beats()) == []
