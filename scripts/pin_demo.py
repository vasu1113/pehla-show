#!/usr/bin/env python
"""Hour 20. Pin the demo runs.

    uv run python ../scripts/pin_demo.py --script ../data/hero_script.txt

Runs the hero script and its fixed variant, prints both so you can *look at
them*, and pins them only if you say yes. After this the demo loads in under
half a second and cannot fail — no network, no model latency, no rate limit,
no surprise at 4pm.

Pinning is deliberately a human step, not something the pipeline does on its
own. Auto-pinning every run would happily serve a bad screening forever; the
whole value of a pinned run is that someone verified it first.

This single hour is worth more than any feature anyone could build in it.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_DIR))

from app import models, store  # noqa: E402
from app.pipeline import analyse, apply_recommended_fix  # noqa: E402
from app.stages.a1_parse import content_hash  # noqa: E402


def describe(run: models.Run, label: str) -> None:
    s = run.summary
    print(f"\n{label}  {run.run_id}  ({run.status})")
    if s:
        print(f"  {s.seats_retained}/{s.seats_total} seats retained "
              f"({s.retained_pct:.0%})")
        for cid, pct in (s.cohort_retention or {}).items():
            print(f"    {cid:12} {pct:5.0%} {'#' * int(pct * 20)}")
    print(f"  {len(run.drop_events)} drop events, {len(run.notes)} notes, "
          f"synthesis={'yes' if run.room_synthesis else 'no'}")
    for w in run.warnings:
        print(f"  ! {w.code}: {w.message}")


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", type=Path, default=API_DIR.parent / "data/hero_script.txt")
    ap.add_argument("--title", default="Adhoori Baat, Episode 1")
    ap.add_argument("--yes", action="store_true", help="skip the confirmation")
    args = ap.parse_args()

    raw = args.script.read_text()
    digest = content_hash(raw)

    original = await analyse("run_pinned_01", raw, args.title)
    describe(original, "ORIGINAL")
    if original.status != "ready":
        print("\nOriginal run did not reach ready. Nothing pinned.")
        return 1

    fix = original.room_synthesis.recommended_fix if original.room_synthesis else None
    fixed = None
    if fix:
        fixed = await apply_recommended_fix(original, fix, "run_pinned_02")
        describe(fixed, "FIXED")
        print(f'\n  fix applied: "{fix}"')

    if not args.yes:
        print("\nDoes this look like the demo you want to give? [y/N] ", end="")
        if input().strip().lower() not in {"y", "yes"}:
            print("Nothing pinned.")
            return 1

    store.pin(original.run_id, digest)
    if fixed is not None and fixed.status == "ready":
        store.pin(fixed.run_id, digest)

    print(f"\npinned: {store.list_pinned()}")
    print("The hero script now serves from cache. Verify it twice before you "
          "stop building.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
