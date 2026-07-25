"""Turn cohort-level attention scores into individual audience fates."""

from __future__ import annotations

import json
from pathlib import Path

from .. import config, models
from .a0_cast import member_name


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


def _reason_label(code: str) -> str:
    return _REASON_LABELS.get(code, code.replace("_", " ").title())


def simulate_population(
    deltas: dict[str, list[models.AttentionDelta]],
    cast: list[tuple[models.Persona, models.Calibration]],
    beats: list[models.Beat],
    seed: int = config.SEED,
) -> list[models.AudienceMember]:
    """Simulate every audience seat through the complete beat sequence."""
    deltas_by_cohort = {
        cohort_id: {delta.beat_id: delta for delta in cohort_deltas}
        for cohort_id, cohort_deltas in deltas.items()
    }
    audience: list[models.AudienceMember] = []

    for seat, (persona, calibration) in enumerate(cast):
        cohort_deltas = deltas_by_cohort.get(persona.id, {})
        patience = calibration.start_patience
        patience_trace = [calibration.start_patience]
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
                multipliers = (
                    calibration.sensitivity
                    if models.is_drain(delta.reason_code)
                    else calibration.replenish
                )
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
                persona_id=persona.id,
                variant_index=calibration.variant_index,
                name=member_name(persona.id, seat),
                start_patience=calibration.start_patience,
                left_at_sec=left_at_sec,
                left_at_beat=left_at_beat,
                reason_code=reason_code,
                reason_label=reason_label,
                evidence=evidence,
                patience_trace=patience_trace,
            )
        )

    return audience
