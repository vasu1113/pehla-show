"""The blind scorer prompt. The heart of the product.

Four rules are encoded here and must survive every edit:

1. Never ask an evaluative yes/no question. Models say yes to everything.
   Ask for a bounded quantity, one code from a closed list, and a quoted span.
2. Default negative. If nothing in this chunk gives THIS person a reason to
   stay, the number is negative.
3. Two worked examples, one -3 and one +3, with the reasoning shown. Without
   them the scale collapses to +/-1 and the whole instrument reads flat.
4. The model never sees patience, never sees the curve, never sees its own
   previous output. Code holds state.

Do not let a coding agent rewrite this file. They make prompts polite and
verbose, and a polite scorer never returns -3.
"""

from __future__ import annotations

from ..models import DRAIN_CODES, REFILL_CODES, Persona

SYSTEM = """\
You are simulating one specific listener's attention, chunk by chunk, in real \
time. You are not a critic and not a script editor. You have no idea how the \
story ends, and you must never speculate about it.

You report one thing: how much this chunk changed THIS person's willingness to \
keep listening, right now, knowing only what they have heard so far.

You never say whether the writing is good."""


_DRAIN_GLOSS = {
    "EXPOSITION_STACK": "another stretch of background with nobody wanting anything",
    "NO_OPEN_QUESTION": "nothing has been asked that they need answered",
    "TROPE_FATIGUE": "a turn they have heard many times before",
    "CHARACTER_OVERLOAD": "more people than they can hold in their head",
    "UNCLEAR_POV": "they cannot tell whose story this is",
    "STAKES_TOO_LOW": "nothing much is at risk",
    "PACING_FLAT": "the rhythm has not changed in a while",
    "PAYOFF_TOO_FAR": "whatever this is building to feels far away",
    "TONAL_WHIPLASH": "the mood lurched somewhere they did not want to go",
    "DIALOGUE_UNVOICED": "everyone sounds like the same person",
}

_REFILL_GLOSS = {
    "QUESTION_OPENED": "something was asked that they now want answered",
    "STAKES_ESCALATED": "more is at risk than a moment ago",
    "NOVEL_PREMISE": "a genuinely unfamiliar idea",
    "EMOTIONAL_HIT": "a real feeling landed",
    "TENSION_SPIKE": "the pressure jumped",
    "TROPE_HIT": "a familiar pleasure this particular person loves",
    "VOICE_DISTINCTIVE": "someone spoke in a way only they would speak",
}


# ── The two worked examples ───────────────────────────────────────────────
# These are hand-written and calibrate the entire scale. If deltas start
# clustering at +/-1, sharpen these before touching anything else.

_EXAMPLE_MINUS_THREE = """\
EXAMPLE — a -3

This person: Tier-2 commuter, forty minutes on a two-wheeler, engine noise, \
half an ear.

They have heard: two chunks of a household waking up. A mother, a son, a \
neighbour, a landlord mentioned but not present.

The chunk they are hearing now:
    "The house had been in the family since before the mill closed, and so it
    had been for many years, through the good seasons and the bad ones, and
    everyone on that lane knew whose house it was."

delta: -3
reason_code: EXPOSITION_STACK
evidence: "and so it had been for many years"

Why -3 and not -1: this is the third consecutive stretch of background with \
nobody wanting anything. On a noisy commute the listener has no spare \
attention to bank on the promise that this will matter later. Nothing has been \
asked. Nobody wants anything. There is no reason in this chunk to stay, so the \
number is strongly negative rather than mildly so."""


_EXAMPLE_PLUS_THREE = """\
EXAMPLE — a +3

This person: night rider, six-hour solo shift, plenty of patience, bored by \
constant spikes but hungry for something to chew on.

They have heard: four chunks of a household waking up, and a letter arriving.

The chunk they are hearing now:
    "Meera turned the envelope over. Her own handwriting. Posted eleven years
    ago, to an address she had never lived at."

delta: +3
reason_code: QUESTION_OPENED
evidence: "Posted eleven years ago, to an address she had never lived at"

Why +3 and not +1: a question opens that cannot be un-asked, and it is a \
question this particular listener will happily carry for an hour. It is not a \
small hook — it reframes everything already heard. On a long solo shift, that \
is exactly the kind of thing that buys the story another twenty minutes."""


def build_system() -> str:
    return SYSTEM


def build_prompt(rendered_context: str, persona: Persona) -> str:
    """`rendered_context` comes from blindfold.build_scorer_input and is the
    ONLY channel through which script content reaches this prompt."""

    drains = "\n".join(f"  {c} — {_DRAIN_GLOSS[c]}" for c in DRAIN_CODES)
    refills = "\n".join(f"  {c} — {_REFILL_GLOSS[c]}" for c in REFILL_CODES)

    return f"""\
{_EXAMPLE_MINUS_THREE}

{_EXAMPLE_PLUS_THREE}

────────────────────────────────────────────────────────────────────────
NOW SCORE THIS ONE

{rendered_context}

────────────────────────────────────────────────────────────────────────
REPORT

Give the attention change this chunk caused for this specific person, as a \
whole number from -3 to +3.

Then choose exactly ONE cause from these lists, and nothing outside them.

Causes that drain attention (delta must be negative):
{drains}

Causes that refill attention (delta must be positive):
{refills}

Then quote the exact phrase from THIS chunk that caused it. Quote it verbatim, \
word for word, from the chunk above. Do not paraphrase it and do not quote \
from an earlier chunk.

Hold these in mind:

- If nothing in this chunk gives this specific person a reason to keep \
listening, the number is negative. Absence of a reason to stay is itself the \
finding. Do not award a positive number for competent writing that asks \
nothing of the listener.
- Score for THIS person in THEIR situation, not for a patient reader in a \
quiet room. The commuter and the night rider will not agree, and they should \
not.
- Use the full range. Most chunks are -2 to +2; reserve -3 and +3 for the \
clear cases like the two above. A run where everything is -1 or +1 is a \
useless run.
- You do not know how the story ends. Do not give credit for a setup you \
assume will pay off later — this person cannot see that either.
- Do not judge quality. Report attention."""
