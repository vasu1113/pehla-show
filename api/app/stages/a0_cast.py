"""Spawn five calibrated listeners from each selected persona."""

from __future__ import annotations

import random

from .. import config, models


SEATS_PER_PERSONA = 5
BASE_PATIENCE = 5.0
PATIENCE_SPREAD = (0.72, 0.82, 1.0, 1.18, 1.32)
SENSITIVITY_SPREAD = (1.28, 0.78, 1.0, 1.18, 0.72)

_PERSONA_NAMES: dict[str, tuple[str, ...]] = {
    "commuter": (
        "Rider on the Outer Ring Road",
        "Passenger watching the Indore flyovers",
        "Commuter waiting at a Pune signal",
        "Someone between two Jaipur bus stops",
        "Rider under a rain-spotted helmet",
    ),
    "kitchen": (
        "Someone half-listening in a kitchen in Nashik",
        "Cook with one ear on the story in Surat",
        "Someone rinsing cups in a Nagpur kitchen",
        "Listener waiting for the pressure cooker",
        "Someone chopping onions after dinner",
    ),
    "night_rider": (
        "Night rider beyond the last streetlight",
        "Driver on the late road out of Bhopal",
        "Someone riding home through Lucknow",
        "Passenger in the last cab of the night",
        "Rider following an empty service lane",
    ),
    "metro_pro": (
        "Producer between two metro stations",
        "Editor standing near the closing doors",
        "Writer changing lines on the Blue Line",
        "Someone taking notes beneath the city",
        "Professional listening through one earbud",
    ),
    "sleep": (
        "Someone listening with the lights off",
        "Listener drifting under a slow fan",
        "Someone awake beside a sleeping house",
        "Listener at the edge of a long day",
        "Someone letting the next episode play",
    ),
    "diaspora": (
        "Listener making tea far from home",
        "Someone hearing familiar rain overseas",
        "Listener awake across another time zone",
        "Someone carrying home in their headphones",
        "Listener by a window in a distant city",
    ),
}

_PERSONA_ORDER = {
    persona_id: index for index, persona_id in enumerate(models.COHORT_IDS)
}


def _persona_order(persona: models.Persona) -> tuple[int, str]:
    return (_PERSONA_ORDER.get(persona.id, len(_PERSONA_ORDER)), persona.id)


def member_name(persona_id: str, seat: int) -> str:
    names = _PERSONA_NAMES.get(persona_id)
    if names:
        return names[seat % len(names)]
    return (
        f"Listener from {persona_id.replace('_', ' ').title()} "
        f"in seat {seat + 1}"
    )


def _jitter(value: float, rng: random.Random) -> float:
    return value * rng.uniform(
        1.0 - config.SENSITIVITY_JITTER,
        1.0 + config.SENSITIVITY_JITTER,
    )


def spawn_audience(
    personas: list[models.Persona],
    seed: int = config.SEED,
) -> list[tuple[models.Persona, models.Calibration]]:
    """Return the fixed thirty-seat cast in deterministic persona blocks."""
    expected = config.SEAT_COUNT
    actual = len(personas) * SEATS_PER_PERSONA
    if actual != expected:
        raise ValueError(
            f"The theatre requires exactly {expected} seats: "
            f"{len(personas)} personas × {SEATS_PER_PERSONA} variants "
            f"would create {actual}."
        )

    cast: list[tuple[models.Persona, models.Calibration]] = []
    for persona in sorted(personas, key=_persona_order):
        for variant_index in range(SEATS_PER_PERSONA):
            seat = len(cast)
            rng = random.Random(seed + seat)
            response_spread = SENSITIVITY_SPREAD[variant_index]
            sensitivity = {
                code: _jitter(response_spread, rng)
                for code in models.DRAIN_CODES
            }
            replenish = {
                code: _jitter(response_spread, rng)
                for code in models.REFILL_CODES
            }
            cast.append(
                (
                    persona,
                    models.Calibration(
                        variant_index=variant_index,
                        start_patience=(
                            BASE_PATIENCE * PATIENCE_SPREAD[variant_index]
                        ),
                        sensitivity=sensitivity,
                        replenish=replenish,
                    ),
                )
            )

    return cast
