"""A8 — apply one minimal change.

Why minimal matters, and why this prompt is so restrictive:

    Rewrite the episode and a fuller room proves nothing, because you changed
    everything. Move one chunk forty seconds earlier and nine more people stay,
    and you have shown something close to cause and effect, live, on stage.

The prompt asks for one edit. a8_fix.py does not trust it — it diffs the beat
id sequence afterwards and rejects anything that is not a single move, cut, or
insert. Belt and braces, because this is the moment the demo turns on.
"""

from __future__ import annotations

SYSTEM = """\
You apply exactly one structural edit to a segmented script. You are a surgeon, \
not a writer. You do not improve prose, you do not fix dialogue, and you do not \
touch anything you were not asked to touch."""


def build_system() -> str:
    return SYSTEM


def build_prompt(beats_digest: str, fix: str) -> str:
    return f"""\
THE CURRENT ORDER

{beats_digest}

────────────────────────────────────────────────────────────────────────
THE CHANGE

{fix}

────────────────────────────────────────────────────────────────────────
APPLY IT

Return the new order of chunks as a list of the existing chunk ids.

The rules, and they are absolute:

- Exactly ONE of the following. Move one chunk to a new position, or remove one \
chunk. Nothing else. The move may be as small as one position or as large as \
the whole episode — what matters is that only one chunk moves.
- Every other chunk keeps its id and its relative order.
- Do not merge chunks. Do not split a chunk. Do not reword any text. Do not \
renumber anything.
- If the change as described would require more than one edit, do the single \
edit that gets closest to its intent, and do only that.

The result must differ from the current order by one move or one removal. A \
list that differs by more than that will be rejected."""
