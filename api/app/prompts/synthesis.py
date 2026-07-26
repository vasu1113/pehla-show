"""A7 — find the pattern across all the notes.

Five separate lists is a report. "The Editor and the audience agree this drags,
the Historian says the texture is the authenticity" is a room. The whole value
of this stage is naming the disagreement, so the prompt pushes for it rather
than smoothing it away.
"""

from __future__ import annotations

SYSTEM = """\
You are the showrunner reading back what the room said. You find where they \
converge, where they genuinely split, and what single change you would make \
first.

You do not add opinions of your own and you do not invent notes nobody filed."""


def build_system() -> str:
    return SYSTEM


def build_prompt(
    notes_digest: str,
    drops_digest: str,
    audience_digest: str,
    seats_lost: int,
) -> str:
    return f"""\
WHAT THE ROOM SAID

{notes_digest}

────────────────────────────────────────────────────────────────────────
WHERE THE ROOM EMPTIED

{drops_digest}

{seats_lost} of 30 listeners left.

────────────────────────────────────────────────────────────────────────
WHAT THE AUDIENCE SAID

{audience_digest}

────────────────────────────────────────────────────────────────────────
SUMMARISE

**Agreement.** Chunks where several critics — or critics and the audience — \
point at the same problem. Name the chunk, state the shared claim in one line, \
and list who holds it. Only count it as agreement if they are actually saying \
the same thing, not merely talking about the same chunk.

**Conflict.** Chunks where two critics take genuinely opposite positions. Give \
both sides, each with its own claim and the agents who hold it. Do not \
manufacture a conflict that is not in the notes — but do not flatten a real \
one into agreement either. If the Editor wants a scene cut and the Historian \
is defending it, that is a conflict and it is the most interesting thing here.

**The one change.** A single, specific, minimal change: move one chunk, cut one \
chunk, or add one line. Name the chunk. Not a rewrite, not a list, not a \
direction — one sentence naming one concrete edit.

**Seats saved.** How many of the {seats_lost} lost listeners you would expect \
that one change to keep. Be honest; a small number is a fine answer.

**Audience readout.** One plain sentence that says what the audience was
drawn to, questioned, or resisted. This is required even when nobody left.

**Critic readout.** One plain sentence naming the most useful critical tension
in the notes. This is required even when the audience retained well.

**Creator value.** One sentence explaining the decision this run makes easier
for a creator, grounded in the audience and critic evidence above. Do not make
generic product-marketing claims.

**Why run it again.** One sentence explaining what the creator should compare
after their next cut or draft. Ground it in this run's evidence, not a promise
of certainty."""
