#!/usr/bin/env python
"""THE CHECKPOINT.

Run the terrible script through A2. Do the numbers go negative?

If everything comes back positive, the model is being polite and every hour
after this is decoration on a lie. Stop the track, fix the prompt, tell the
team. This is the most important moment of the build and it is Track A's to
call.

    uv run python ../scripts/check_negative.py

Exits non-zero when the gate fails, so it is a gate and not a vibe.

This is only satisfied by the REAL backend. A fake going negative on demand
proves nothing — it is wired to. With LLM_BACKEND=fake the script says so and
exits non-zero rather than reporting a pass it has not earned.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_DIR))

from app import config, models  # noqa: E402
from app.llm import get_llm  # noqa: E402
from app.stages.a1_parse import parse_beats  # noqa: E402
from app.stages.a2_score import score_persona  # noqa: E402

# The terrible script should be clearly, unarguably negative — not marginally
# so. A mean of -0.2 is a model hedging, which is the failure we are looking
# for.
MEAN_DELTA_CEILING = -0.5
#: At least this share of beats must drain. A few polite positives are fine;
#: a majority of them is the failure.
MIN_DRAIN_SHARE = 0.6


async def main() -> int:
    if config.LLM_BACKEND != "openai":
        print("BACKEND IS 'fake' — the checkpoint is not satisfiable.")
        print()
        print("A fake going negative proves nothing; it is wired to. Set")
        print("LLM_BACKEND=openai with a real key and run this again. Until")
        print("then this gate is UNMET, not passed.")
        return 2

    terrible = (config.DATA_DIR / "terrible_script.txt").read_text()
    hero = (config.DATA_DIR / "hero_script.txt").read_text()
    personas = [
        models.Persona(**c)
        for c in json.loads((config.DATA_DIR / "personas.json").read_text())["cohorts"]
    ]
    llm = get_llm()

    results: dict[str, float] = {}
    drain_shares: dict[str, float] = {}

    for label, text in (("terrible", terrible), ("hero", hero)):
        beats = await parse_beats(text, llm)
        scored = await asyncio.gather(
            *(score_persona(beats, p, llm) for p in personas)
        )
        deltas = [d.delta for cohort in scored for d in cohort]
        drains = [d for cohort in scored for d in cohort if models.is_drain(d.reason_code)]

        results[label] = sum(deltas) / len(deltas)
        drain_shares[label] = len(drains) / len(deltas)

        print(f"{label:9} {len(beats):3} beats  mean delta {results[label]:+.2f}  "
              f"{drain_shares[label]:.0%} drains")

    print()
    ok = True

    if results["terrible"] > MEAN_DELTA_CEILING:
        print(f"FAIL  terrible script scored {results['terrible']:+.2f}, "
              f"needs {MEAN_DELTA_CEILING:+.2f} or lower.")
        ok = False
    if drain_shares["terrible"] < MIN_DRAIN_SHARE:
        print(f"FAIL  only {drain_shares['terrible']:.0%} of beats drained, "
              f"needs {MIN_DRAIN_SHARE:.0%}.")
        ok = False

    # The other half of the gate: a scorer that hates everything is just as
    # useless as one that likes everything. The hero script must score better.
    if results["hero"] <= results["terrible"]:
        print(f"FAIL  hero ({results['hero']:+.2f}) did not score better than "
              f"terrible ({results['terrible']:+.2f}). The scorer is not "
              f"discriminating, it is just negative.")
        ok = False

    if ok:
        print("PASS  the instrument can say no, and it can tell the two apart.")
        return 0

    print()
    print("STOP THE TRACK. The usual fix is in app/prompts/scorer.py:")
    print("  - strengthen the default-negative framing")
    print("  - sharpen the -3 worked example so the scale does not collapse")
    print("Tell the team before anyone builds another hour on top of this.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
