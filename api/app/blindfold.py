"""The blindfold.

This module owns the ONLY function permitted to build input for the audience
scorer. Nothing else anywhere in the codebase may assemble a scorer prompt.

Why this file is the whole product:

    A writer thinks page three is fine because they know the twist on page
    fourteen. A real listener does not. If the model can see the ending, it
    forgives the slow start exactly like the writer does, and the tool becomes
    worthless.

Every other AI script tool reads the ending. Ours cannot. When scoring beat N
the model sees beats 1..N and nothing else — no title, no genre, no summary,
no beat N+1, no patience state, no previous scores.

`assert_no_leak` is called on every build. It is a runtime assertion, not just
a test, because a leak is silent: the run still completes, the numbers still
look plausible, and the product is quietly a lie.
"""

from __future__ import annotations

import re

from .models import Beat, Persona


class BlindfoldViolation(AssertionError):
    """Raised when future-beat content reaches the scorer. Never catch this."""


#: Any run of this many characters from a future beat appearing in the prompt
#: is treated as a leak. Short enough to catch a stray sentence, long enough
#: that common phrases ("she said") don't trip it.
_LEAK_WINDOW = 40


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _shingles(text: str, window: int = _LEAK_WINDOW) -> set[str]:
    """Overlapping character windows, so a leak survives reformatting."""
    flat = _normalise(text)
    if len(flat) < window:
        return {flat} if flat else set()
    step = max(1, window // 4)
    return {flat[i : i + window] for i in range(0, len(flat) - window + 1, step)}


def assert_no_leak(rendered: str, beats: list[Beat], upto: int) -> None:
    """Fail loudly if any beat after `upto` shows up in `rendered`."""
    haystack = _normalise(rendered)
    for future in beats[upto + 1 :]:
        for shingle in _shingles(future.text_span):
            if shingle and shingle in haystack:
                raise BlindfoldViolation(
                    f"beat {future.id} leaked into the scorer input for "
                    f"beat {beats[upto].id}: {shingle!r}"
                )


def build_scorer_input(beats: list[Beat], upto: int, persona: Persona) -> str:
    """Assemble everything the scorer is allowed to see for beat `upto`.

    `beats` is the full list only so we can slice it and assert on the tail —
    nothing past `upto` is ever rendered.
    """
    if not 0 <= upto < len(beats):
        raise IndexError(f"upto={upto} out of range for {len(beats)} beats")

    heard = beats[: upto + 1]
    current = beats[upto]

    lines: list[str] = []
    lines.append("THIS PERSON")
    lines.append(f"{persona.label}. {persona.context}")
    lines.append("")

    if upto > 0:
        lines.append(f"WHAT THEY HAVE HEARD SO FAR (chunks 1-{upto})")
        for beat in heard[:-1]:
            lines.append(f"[{beat.index + 1}] {beat.text_span.strip()}")
        lines.append("")
    else:
        lines.append("They have heard nothing yet. This is the opening.")
        lines.append("")

    lines.append(f"THE CHUNK THEY ARE HEARING NOW (chunk {current.index + 1})")
    lines.append(current.text_span.strip())

    rendered = "\n".join(lines)

    # Not a test. A runtime gate — a leak is silent and would invalidate
    # everything downstream of it.
    assert_no_leak(rendered, beats, upto)
    return rendered
