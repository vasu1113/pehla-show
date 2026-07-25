from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Run


@dataclass(frozen=True)
class RunExpectation:
    name: str
    minimum_retained: float | None = None
    maximum_retained: float | None = None
    require_structural_drop: bool = False
    structural_window: tuple[int, int] | None = None
    required_reason_codes: frozenset[str] = field(default_factory=frozenset)


def validate_run(run: Run, expectation: RunExpectation) -> list[str]:
    """Return plain-language gate failures; an empty list means pass."""
    failures: list[str] = []
    if run.status != "ready":
        return [f"{expectation.name}: run status is {run.status}, not ready"]
    if run.summary is None:
        return [f"{expectation.name}: summary is missing"]

    leavers = {
        member.seat
        for member in run.audience
        if member.left_at_sec is not None
    }
    expected_retained = len(run.audience) - len(leavers)
    if run.summary.seats_retained != expected_retained:
        failures.append(
            f"{expectation.name}: summary says "
            f"{run.summary.seats_retained} retained but audience says "
            f"{expected_retained}"
        )

    event_leavers = {
        seat
        for event in run.drop_events
        for seat in event.seats_lost
    }
    if not event_leavers.issubset(leavers):
        failures.append(
            f"{expectation.name}: a drop event includes someone who did not leave"
        )

    retained = run.summary.retained_pct
    if (
        expectation.minimum_retained is not None
        and retained < expectation.minimum_retained
    ):
        failures.append(
            f"{expectation.name}: retention {retained:.1%} is below "
            f"{expectation.minimum_retained:.1%}"
        )
    if (
        expectation.maximum_retained is not None
        and retained > expectation.maximum_retained
    ):
        failures.append(
            f"{expectation.name}: retention {retained:.1%} is above "
            f"{expectation.maximum_retained:.1%}"
        )

    structural = [
        event for event in run.drop_events if event.kind == "structural"
    ]
    if expectation.require_structural_drop and not structural:
        failures.append(f"{expectation.name}: no structural drop was found")

    if expectation.structural_window is not None:
        start, end = expectation.structural_window
        if not any(start <= event.timestamp <= end for event in structural):
            failures.append(
                f"{expectation.name}: no structural drop appeared between "
                f"{start}s and {end}s"
            )

    observed_codes = {event.reason_code for event in run.drop_events}
    missing_codes = expectation.required_reason_codes - observed_codes
    if missing_codes:
        failures.append(
            f"{expectation.name}: missing expected reasons "
            f"{', '.join(sorted(missing_codes))}"
        )
    return failures


def validate_ranking(
    better: Run,
    worse: Run,
    *,
    better_name: str,
    worse_name: str,
    minimum_margin: float = 0.1,
) -> list[str]:
    if better.summary is None or worse.summary is None:
        return [f"{better_name}/{worse_name}: a summary is missing"]
    margin = better.summary.retained_pct - worse.summary.retained_pct
    if margin < minimum_margin:
        return [
            f"{better_name} should retain at least {minimum_margin:.0%} more "
            f"than {worse_name}; observed margin was {margin:.1%}"
        ]
    return []
