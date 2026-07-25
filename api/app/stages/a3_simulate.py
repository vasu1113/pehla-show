"""Turn cohort-level attention scores into individual audience fates."""

from __future__ import annotations

import json
import random
from pathlib import Path

from .. import config, models


_COHORT_NAMES: dict[str, tuple[str, ...]] = {
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


def _reason_labels(path: Path = config.DATA_DIR / "taxonomy.json") -> dict[str, str]:
    if not path.is_file():
        return {}

    try:
        taxonomy = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    labels: dict[str, str] = {}
    if not isinstance(taxonomy, dict):
        return labels
    for section in ("drain", "refill"):
        entries = taxonomy.get(section, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            code, label = entry.get("code"), entry.get("label")
            if isinstance(code, str) and isinstance(label, str):
                labels[code] = label
    return labels


_REASON_LABELS = _reason_labels()
_COHORT_ORDER = {cohort_id: index for index, cohort_id in enumerate(models.COHORT_IDS)}


def _jitter(value: float, amount: float, rng: random.Random) -> float:
    return value * rng.uniform(1.0 - amount, 1.0 + amount)


def _jittered_multipliers(
    multipliers: dict[str, float],
    rng: random.Random,
) -> dict[str, float]:
    return {
        code: _jitter(multipliers[code], config.SENSITIVITY_JITTER, rng)
        for code in sorted(multipliers)
    }


def _persona_order(persona: models.Persona) -> tuple[int, str]:
    return (_COHORT_ORDER.get(persona.id, len(_COHORT_ORDER)), persona.id)


def _member_name(cohort: str, seat: int) -> str:
    names = _COHORT_NAMES.get(cohort)
    if names:
        return names[seat % len(names)]
    return f"Listener from {cohort.replace('_', ' ').title()} in seat {seat + 1}"


def _reason_label(code: str) -> str:
    return _REASON_LABELS.get(code, code.replace("_", " ").title())


def simulate_population(
    deltas: dict[str, list[models.AttentionDelta]],
    personas: list[models.Persona],
    beats: list[models.Beat],
    seats_per_cohort: int = config.SEATS_PER_COHORT,
    seed: int = config.SEED,
) -> list[models.AudienceMember]:
    """Simulate every audience seat through the complete beat sequence."""
    deltas_by_cohort = {
        cohort_id: {delta.beat_id: delta for delta in cohort_deltas}
        for cohort_id, cohort_deltas in deltas.items()
    }
    audience: list[models.AudienceMember] = []

    for persona in sorted(personas, key=_persona_order):
        cohort_deltas = deltas_by_cohort.get(persona.id, {})
        for _ in range(seats_per_cohort):
            seat = len(audience)
            rng = random.Random(seed + seat)
            start_patience = _jitter(
                persona.start_patience,
                config.PATIENCE_JITTER,
                rng,
            )
            sensitivity = _jittered_multipliers(persona.sensitivity, rng)
            replenish = _jittered_multipliers(persona.replenish, rng)

            patience = start_patience
            patience_trace = [start_patience]
            left_at_sec: int | None = None
            left_at_beat: int | None = None
            reason_code: str | None = None
            reason_label: str | None = None
            evidence: str | None = None

            for beat in beats:
                if left_at_sec is not None:
                    patience_trace.append(0.0)
                    continue

                delta = cohort_deltas.get(beat.id)
                if delta is not None:
                    multipliers = sensitivity if models.is_drain(delta.reason_code) else replenish
                    patience += (
                        delta.delta
                        * multipliers.get(delta.reason_code, 1.0)
                        * config.PATIENCE_SCALE
                    )

                    if patience <= 0.0:
                        patience = 0.0
                        left_at_sec = beat.start_sec
                        left_at_beat = beat.id
                        reason_code = delta.reason_code
                        reason_label = _reason_label(delta.reason_code)
                        evidence = delta.evidence

                patience_trace.append(patience)

            audience.append(
                models.AudienceMember(
                    seat=seat,
                    cohort=persona.id,
                    name=_member_name(persona.id, seat),
                    start_patience=start_patience,
                    left_at_sec=left_at_sec,
                    left_at_beat=left_at_beat,
                    reason_code=reason_code,
                    reason_label=reason_label,
                    evidence=evidence,
                    patience_trace=patience_trace,
                )
            )

    return audience
