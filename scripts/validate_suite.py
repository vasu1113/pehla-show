#!/usr/bin/env python
"""Validate three real run artifacts before a demo or model promotion.

Example:
    api/.venv/bin/python scripts/validate_suite.py \
      --strong work/strong-run.json \
      --hero work/hero-run.json \
      --terrible work/terrible-run.json

This gate intentionally contains no persona-separation target. Track C owns
persona calibration; this script checks run truth, ranking, and the planted
structural flaw only.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_DIR))

from app.models import Run  # noqa: E402
from app.validation import (  # noqa: E402
    RunExpectation,
    validate_ranking,
    validate_run,
)


def load_run(path: Path) -> Run:
    return Run.model_validate(json.loads(path.read_text(encoding="utf-8")))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strong", required=True, type=Path)
    parser.add_argument("--hero", required=True, type=Path)
    parser.add_argument("--terrible", required=True, type=Path)
    parser.add_argument("--hero-window", default="150:300")
    args = parser.parse_args()

    start, end = (int(value) for value in args.hero_window.split(":", 1))
    strong = load_run(args.strong)
    hero = load_run(args.hero)
    terrible = load_run(args.terrible)

    failures = [
        *validate_run(
            strong,
            RunExpectation(name="strong", minimum_retained=0.65),
        ),
        *validate_run(
            hero,
            RunExpectation(
                name="hero",
                require_structural_drop=True,
                structural_window=(start, end),
                required_reason_codes=frozenset(
                    {"EXPOSITION_STACK", "NO_OPEN_QUESTION"}
                ),
            ),
        ),
        *validate_run(
            terrible,
            RunExpectation(name="terrible", maximum_retained=0.45),
        ),
        *validate_ranking(
            strong,
            hero,
            better_name="strong",
            worse_name="hero",
        ),
        *validate_ranking(
            hero,
            terrible,
            better_name="hero",
            worse_name="terrible",
        ),
    ]

    if failures:
        for failure in failures:
            print(f"FAIL  {failure}")
        return 1
    print("PASS  strong, hero, and terrible runs satisfy the validation gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
