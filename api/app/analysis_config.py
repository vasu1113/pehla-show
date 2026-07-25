from __future__ import annotations

import hashlib
import json

from app import config, models


def build(persona_ids: list[str]) -> models.AnalysisConfig:
    return models.AnalysisConfig(
        persona_ids=list(persona_ids),
        pipeline_version=config.PIPELINE_VERSION,
        parser_version=config.PARSER_VERSION,
        scorer_version=config.SCORER_VERSION,
        simulation_version=config.SIMULATION_VERSION,
    )


def fingerprint(value: models.AnalysisConfig | None) -> str:
    if value is None:
        return "legacy"
    encoded = json.dumps(
        value.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:20]


def matches(
    run: models.Run,
    requested: models.AnalysisConfig | None,
) -> bool:
    if requested is None:
        return True
    return run.analysis_config == requested
