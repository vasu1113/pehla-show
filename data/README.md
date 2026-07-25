# Demo assets

## The planted flaw (read this before tuning anything)

`hero_script.txt` — *Adhoori Baat*, Episode 1 — has **one structural flaw we put
there on purpose**, and we know the answer before the tool gives it. That is the
whole point of a hero script: if the tool finds something else, either the tool
is wrong or we learned something, and we need to be able to tell which.

**The flaw:** the letter arrives around chunk 13–15. Before it, there are three
consecutive chunks of household texture — the kettle, the radio, the two cups,
and then the long block beginning *"The house has been in the family since
before the mill closed…"* — in which nobody wants anything and no question is
open. It is competent writing. It is also three minutes of a listener being
given no reason to stay.

**What the tool should find:**

- A cliff around 3–4 minutes, at the "and so it had been for many years" block.
- `EXPOSITION_STACK` and `NO_OPEN_QUESTION` as the dominant reason codes.
- `kind: "structural"` — the commuter and the kitchen listener both bail there;
  it is not a taste split.
- The night rider and the diaspora listener should survive it. If all six
  cohorts flatline together, the personas are undertuned.
- The Editor should want the texture block cut. The Historian should defend it
  as exactly the thing that makes the lane feel inhabited. **That disagreement
  is the most interesting thing that will be on screen** — if they agree, fix
  the lenses, not the script.

**The fix the room should recommend:** move the letter's arrival earlier —
roughly "move the reveal at chunk 14 to position 3". Applying it should visibly
retain more seats, because the question opens before the texture rather than
after it. Same words, different order. That is the demo.

## The other file

`terrible_script.txt` — *The Inheritance* — is deliberately awful and exists for
one reason: **to prove the tool can say no.** Five characters named in the first
thirty seconds, a narrator explaining the plumbing, dialogue where people
announce facts they all already know, and not a single open question anywhere.

This is what `scripts/check_negative.py` runs. If the scorer comes back positive
on this, the model is being polite and every hour after that is decoration on a
lie. Stop the track and fix the prompt.

## Track C hand-off

`personas.json` and `taxonomy.json` are shape-correct placeholders. Track C
replaces them at hour 13 with corpus-calibrated versions and `calibrated_from`
counts. That swap is a file replacement — no code change on our side.
