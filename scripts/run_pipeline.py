#!/usr/bin/env python
"""Run the screening end to end from the command line. No server needed.

    uv run python ../scripts/run_pipeline.py --script ../data/hero_script.txt
    uv run python ../scripts/run_pipeline.py --script ../data/hero_script.txt --emit-mock

`--emit-mock` writes data/mockRun.json, which is what the frontend builds
against until the API is live.

Works with LLM_BACKEND=fake (the default) so this is runnable with no key.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_DIR))

from app import config, models  # noqa: E402
from app.llm import get_llm  # noqa: E402
from app.stages.a1_parse import content_hash, parse_beats  # noqa: E402
from app.stages.a2_score import score_persona_verbose  # noqa: E402
from app.stages.a3_simulate import simulate_population  # noqa: E402
from app.stages.a4_cliffs import detect_cliffs  # noqa: E402
from app.stages.a6_experts import convene_room  # noqa: E402
from app.stages.a7_synth import synthesise_room  # noqa: E402
from app.prompts.expert import LENSES as EXPERT_LENSES  # noqa: E402


def load_personas() -> list[models.Persona]:
    raw = json.loads((config.DATA_DIR / "personas.json").read_text())
    return [models.Persona(**c) for c in raw["cohorts"]]


async def run(raw_text: str, title: str) -> models.Run:
    llm = get_llm()
    personas = load_personas()

    beats = await parse_beats(raw_text, llm)
    print(f"A1  {len(beats)} beats, {beats[-1].end_sec}s")

    # The six cohorts run concurrently — sequential would be ~90s of silence.
    # Within a cohort, beats stay sequential; that is the blindfold.
    results = await asyncio.gather(
        *(score_persona_verbose(beats, p, llm) for p in personas),
        return_exceptions=True,
    )

    deltas: dict[str, list[models.AttentionDelta]] = {}
    warnings: list[models.Warning] = []
    kept: list[models.Persona] = []

    for persona, result in zip(personas, results):
        if isinstance(result, BaseException):
            warnings.append(
                models.Warning(
                    code="COHORT_DROPPED",
                    message=f"{persona.label} could not be simulated.",
                )
            )
            continue
        scores, degraded = result
        deltas[persona.id] = scores
        kept.append(persona)
        if degraded:
            warnings.append(
                models.Warning(
                    code="BEATS_DEGRADED",
                    message=f"{degraded} beat(s) scored neutral for {persona.label}.",
                )
            )

    # The audience is the product. Three cohorts down is not a screening.
    if len(personas) - len(kept) >= 3:
        raise RuntimeError("three or more cohorts failed — the run is not valid")

    print(f"A2  {len(kept)}/{len(personas)} cohorts scored")

    audience = simulate_population(deltas, kept, beats)
    drops = detect_cliffs(audience, beats)

    left = [m for m in audience if m.left_at_sec is not None]
    print(f"A3  {len(audience) - len(left)}/{len(audience)} seats retained")
    print(f"A4  {len(drops)} drop events")

    # The five critics fire in parallel, and never raise — an empty room is a
    # degraded screening, not a failed one.
    notes, room_warnings = await convene_room(raw_text, beats, drops, llm)
    warnings.extend(room_warnings)
    print(f"A6  {len(notes)} notes from {len({n.agent_id for n in notes})} critics")

    synthesis = await synthesise_room(notes, drops, len(left), llm)
    print(f"A7  {'synthesised' if synthesis else 'unavailable — notes stay ungrouped'}")

    cohort_retention: dict[str, float] = {}
    for p in kept:
        seats = [m for m in audience if m.cohort == p.id]
        stayed = [m for m in seats if m.left_at_sec is None]
        cohort_retention[p.id] = round(len(stayed) / len(seats), 3) if seats else 0.0

    words = len(raw_text.split())
    return models.Run(
        run_id="run_mock01",
        status="ready",
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        script=models.ScriptMeta(
            id=content_hash(raw_text)[:12],
            title=title,
            duration_sec=beats[-1].end_sec,
            word_count=words,
        ),
        beats=beats,
        cohorts=[
            models.Cohort(
                id=p.id,
                label=p.label,
                context=p.context,
                seat_count=p.seat_count,
                retained_pct=cohort_retention.get(p.id, 0.0),
            )
            for p in kept
        ],
        audience=audience,
        drop_events=drops,
        agents=[
            models.AgentMeta(id=a.value, label=lens["label"], lens=lens["lens"])
            for a, lens in EXPERT_LENSES.items()
        ],
        notes=notes,
        room_synthesis=synthesis,
        summary=models.Summary(
            retained_pct=round((len(audience) - len(left)) / len(audience), 3),
            seats_total=len(audience),
            seats_retained=len(audience) - len(left),
            biggest_cliff_sec=(
                max(drops, key=lambda d: len(d.seats_lost)).timestamp if drops else None
            ),
            cohort_retention=cohort_retention,
        ),
        warnings=warnings,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True, type=Path)
    ap.add_argument("--title", default="Adhoori Baat, Episode 1")
    ap.add_argument("--emit-mock", action="store_true")
    args = ap.parse_args()

    raw = args.script.read_text()
    print(f"backend={config.LLM_BACKEND}  {len(raw.split())} words\n")

    run_obj = asyncio.run(run(raw, args.title))

    print("\ncohort retention")
    for cid, pct in (run_obj.summary.cohort_retention or {}).items():
        bar = "#" * int(pct * 20)
        print(f"  {cid:12} {pct:5.0%} {bar}")

    for w in run_obj.warnings:
        print(f"  ! {w.code}: {w.message}")

    if args.emit_mock:
        out = config.DATA_DIR / "mockRun.json"
        out.write_text(json.dumps(run_obj.model_dump(mode="json"), indent=2))
        print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
