"""Detect and diagnose clustered audience walkouts."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from typing import TypeVar

from ..models import AudienceMember, Beat, DropEvent


WINDOW_SIZE_SEC = 10
MIN_SEATS_FOR_CLIFF = 2
STRUCTURAL_COHORT_THRESHOLD = 3

_T = TypeVar("_T", str, int)


def _mode(values: Iterable[_T]) -> _T:
    counts = Counter(values)
    return min(counts, key=lambda value: (-counts[value], value))


def _fallback_beat_id(timestamp: int, beats: list[Beat]) -> int:
    containing = [
        beat.id
        for beat in beats
        if beat.start_sec <= timestamp < beat.end_sec
    ]
    if containing:
        return min(containing)

    preceding = [beat for beat in beats if beat.start_sec <= timestamp]
    if preceding:
        return max(preceding, key=lambda beat: (beat.start_sec, -beat.id)).id
    return min(beats, key=lambda beat: (beat.start_sec, beat.id)).id


def _member_beat_id(member: AudienceMember, beats: list[Beat]) -> int:
    if member.left_at_beat is not None:
        return member.left_at_beat
    if member.left_at_sec is None or not beats:
        return 0
    return _fallback_beat_id(member.left_at_sec, beats)


def _reason_label(code: str, members: list[AudienceMember]) -> str:
    labels = [
        member.reason_label
        for member in members
        if member.reason_code == code and member.reason_label is not None
    ]
    return _mode(labels) if labels else code.replace("_", " ").title()


def detect_cliffs(
    audience: list[AudienceMember],
    beats: list[Beat],
) -> list[DropEvent]:
    """Group nearby exits and classify each meaningful audience cliff."""
    windows: dict[int, list[AudienceMember]] = {}
    for member in audience:
        if member.left_at_sec is None:
            continue
        window = member.left_at_sec // WINDOW_SIZE_SEC
        windows.setdefault(window, []).append(member)

    events: list[DropEvent] = []
    for window in sorted(windows):
        leavers = windows[window]
        if len(leavers) < MIN_SEATS_FOR_CLIFF:
            continue

        reason_code = _mode(member.reason_code or "UNKNOWN" for member in leavers)
        reason_members = [
            member for member in leavers if (member.reason_code or "UNKNOWN") == reason_code
        ]
        evidence = _mode(member.evidence or "" for member in reason_members)
        cohort_counts = Counter(member.cohort for member in leavers)
        cohort_breakdown = {
            cohort: cohort_counts[cohort]
            for cohort in sorted(cohort_counts)
        }
        kind = (
            "structural"
            if len(cohort_counts) >= STRUCTURAL_COHORT_THRESHOLD
            else "taste_split"
        )

        events.append(
            DropEvent(
                id=f"de_{len(events) + 1:02d}",
                timestamp=min(
                    member.left_at_sec
                    for member in leavers
                    if member.left_at_sec is not None
                ),
                beat_id=_mode(_member_beat_id(member, beats) for member in leavers),
                seats_lost=sorted(member.seat for member in leavers),
                cohort_breakdown=cohort_breakdown,
                reason_code=reason_code,
                reason_label=_reason_label(reason_code, reason_members),
                evidence=evidence,
                kind=kind,
            )
        )

    return events
