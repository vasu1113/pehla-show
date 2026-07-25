"""The test that matters most.

If the blindfold leaks, the run still completes and the numbers still look
plausible — the product is just quietly worthless. So this is checked
exhaustively, at every beat index, on realistic text.
"""

from __future__ import annotations

import pytest

from app.blindfold import BlindfoldViolation, build_scorer_input
from app.models import Beat, BeatType, Persona

# Deliberately distinctive spans: if any of these strings shows up in a prompt
# it should not be in, we want it to be unmistakable.
_SPANS = [
    "INT. KITCHEN - MORNING. Meera sets the kettle down and does not look up.",
    "The neighbour's radio starts, the same programme it always is at this hour.",
    "Rajan asks about the landlord. Nobody answers him for a long moment.",
    "The house had been in the family since before the mill closed.",
    "A letter arrives, and the boy who brings it will not meet her eye.",
    "Meera turns the envelope over. Her own handwriting, eleven years old.",
    "She has never lived at the address on the front of it.",
    "Rajan says the name of a town that no one in the house has said aloud.",
    "The kettle boils over and neither of them moves to lift it.",
    "In the doorway, someone has been listening the whole time.",
]


def _beats() -> list[Beat]:
    return [
        Beat(
            id=i,
            index=i,
            start_sec=i * 30,
            end_sec=(i + 1) * 30,
            text_span=span,
            type=BeatType.exposition,
            tension_delta=0,
            stakes_level=2,
        )
        for i, span in enumerate(_SPANS)
    ]


def _persona() -> Persona:
    return Persona(
        id="commuter",
        label="Tier-2 commuter",
        prompt="40 min two-wheeler, noisy",
    )


@pytest.mark.parametrize("upto", range(len(_SPANS)))
def test_no_future_beat_reaches_the_scorer(upto: int) -> None:
    beats, persona = _beats(), _persona()
    rendered = build_scorer_input(beats, upto, persona)

    for future in beats[upto + 1 :]:
        assert future.text_span not in rendered, (
            f"beat {future.id} leaked into the prompt for beat {upto}"
        )


@pytest.mark.parametrize("upto", range(len(_SPANS)))
def test_everything_already_heard_is_present(upto: int) -> None:
    beats, persona = _beats(), _persona()
    rendered = build_scorer_input(beats, upto, persona)

    for heard in beats[: upto + 1]:
        assert heard.text_span in rendered, (
            f"beat {heard.id} should be audible by beat {upto} but is missing"
        )


def test_the_guard_actually_fires() -> None:
    """A leak detector that never fires is not a leak detector."""
    beats, persona = _beats(), _persona()
    # Smuggle a future beat into the current one.
    beats[2].text_span += " " + beats[7].text_span

    with pytest.raises(BlindfoldViolation):
        build_scorer_input(beats, 2, persona)


def test_the_guard_survives_reformatting() -> None:
    """Whitespace and case changes must not let a leak through."""
    beats, persona = _beats(), _persona()
    mangled = beats[8].text_span.upper().replace(" ", "\n  ")
    beats[1].text_span += " " + mangled

    with pytest.raises(BlindfoldViolation):
        build_scorer_input(beats, 1, persona)


def test_no_title_or_genre_channel_exists() -> None:
    """There is deliberately no parameter through which a title could arrive."""
    import inspect

    params = set(inspect.signature(build_scorer_input).parameters)
    assert params == {"beats", "upto", "persona"}


def test_opening_beat_says_they_have_heard_nothing() -> None:
    rendered = build_scorer_input(_beats(), 0, _persona())
    assert "heard nothing yet" in rendered
    assert _SPANS[0] in rendered


def test_out_of_range_is_an_error_not_a_silent_clamp() -> None:
    beats, persona = _beats(), _persona()
    with pytest.raises(IndexError):
        build_scorer_input(beats, len(beats), persona)
