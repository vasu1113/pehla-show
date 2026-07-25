"""A1 — cut the script into numbered chunks and tag each one.

Note what is NOT asked for here: timings. Start and end seconds are arithmetic
(cumulative words / 150 per minute) and are computed in Python. Anything a
model can get arithmetically wrong, code does instead.
"""

from __future__ import annotations

SYSTEM = """\
You segment audio-drama scripts into the units a listener actually experiences \
— a run of script that does one thing before the story turns to do the next.

You cut on turns: a new want, a new arrival, a reveal, a change of place, a \
change of pressure. You do not cut on paragraph breaks or on length alone."""


def build_system() -> str:
    return SYSTEM


def build_prompt(raw_text: str, target_low: int = 15, target_high: int = 25) -> str:
    return f"""\
THE SCRIPT

{raw_text}

────────────────────────────────────────────────────────────────────────
CUT IT INTO CHUNKS

Aim for {target_low} to {target_high} chunks. Each chunk covers a continuous \
run of the script — together they must cover the whole thing in order, with \
nothing dropped, nothing overlapping, and nothing invented.

For each chunk give:

- `text_span` — the actual script text of that chunk, copied verbatim. Do not \
summarise it, do not clean it up, do not re-punctuate it.
- `type` — one of: setup, exposition, conflict, reveal, banter, action, \
cliffhanger.
- `tension_delta` — how much the pressure changed across this chunk, -3 to +3.
- `questions_opened` — anything this chunk makes a listener want answered. \
Short phrases, not sentences. Empty if it opens nothing.
- `questions_closed` — anything answered here that was open before.
- `characters_present` — who actually appears or speaks. Not who is mentioned.
- `stakes_level` — how much is at risk in this chunk, 1 to 5.

Cut where the story turns, not where the lengths come out even. Chunks may \
vary in size. If a stretch runs long because nothing turns in it, that is a \
real finding and the chunk should be long."""
