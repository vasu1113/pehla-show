from __future__ import annotations

from app.models import (
    AudienceMember,
    DropEvent,
    Run,
    ScriptMeta,
    Summary,
)
from app.validation import RunExpectation, validate_ranking, validate_run


def _run(
    run_id: str,
    retained: int,
    *,
    structural: bool = False,
) -> Run:
    audience = [
        AudienceMember(
            seat=seat,
            cohort=f"cohort_{seat % 6}",
            persona_id=f"persona_{seat % 6}",
            variant_index=seat % 5,
            name=f"Listener {seat}",
            start_patience=5,
            left_at_sec=210 if seat >= retained else None,
            left_at_beat=7 if seat >= retained else None,
            reason_code="EXPOSITION_STACK" if seat >= retained else None,
            reason_label="Exposition stack" if seat >= retained else None,
            evidence="The house had always stood there." if seat >= retained else None,
            patience_trace=[5, 0 if seat >= retained else 4],
        )
        for seat in range(30)
    ]
    leavers = list(range(retained, 30))
    drops = []
    if leavers:
        drops.append(
            DropEvent(
                id="de_01",
                timestamp=210,
                beat_id=7,
                seats_lost=leavers,
                cohort_breakdown={
                    f"cohort_{index}": sum(
                        seat % 6 == index for seat in leavers
                    )
                    for index in range(6)
                },
                reason_code="EXPOSITION_STACK",
                reason_label="Exposition stack",
                evidence="The house had always stood there.",
                kind="structural" if structural else "taste_split",
            )
        )
    return Run(
        run_id=run_id,
        status="ready",
        created_at="2026-07-26T00:00:00+00:00",
        script=ScriptMeta(
            id=f"script_{run_id}",
            title=run_id,
            duration_sec=600,
            word_count=1200,
        ),
        audience=audience,
        drop_events=drops,
        summary=Summary(
            retained_pct=retained / 30,
            seats_total=30,
            seats_retained=retained,
        ),
    )


def test_validation_suite_accepts_known_good_ordering() -> None:
    strong = _run("run_strong", 27)
    hero = _run("run_hero", 18, structural=True)
    terrible = _run("run_terrible", 9)

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
                structural_window=(180, 260),
                required_reason_codes=frozenset({"EXPOSITION_STACK"}),
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

    assert failures == []


def test_validation_suite_rejects_hidden_walkouts() -> None:
    run = _run("run_mismatch", 20)
    run.summary.seats_retained = 29

    failures = validate_run(run, RunExpectation(name="mismatch"))

    assert any("summary says 29 retained" in failure for failure in failures)


def test_validation_suite_requires_the_planted_structural_drop() -> None:
    run = _run("run_no_structure", 18, structural=False)

    failures = validate_run(
        run,
        RunExpectation(name="hero", require_structural_drop=True),
    )

    assert failures == ["hero: no structural drop was found"]
