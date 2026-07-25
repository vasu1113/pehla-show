/**
 * B6 — the verdict. Runs in the ~6.5s the clock keeps going after the film ends.
 * `vt` (verdict time) = currentSeconds - filmTotal, i.e. seconds into the verdict.
 *
 * The choreography (spec):
 *   0.0  film fades to dark
 *   0.5  everyone settles into their verdict pose
 *   1.0  speech bubbles begin, staggered
 *   2.5  the popcorn throws
 *   4.0  the critics speak (their final reviews)
 *   6.0  hold
 *
 * Everything below is a pure function of `vt`, so scrubbing is exact and
 * scrubbing back before the film's end clears the whole verdict.
 */
export const VERDICT = {
  poses: 0.5,
  bubbles: 1.0,
  popcorn: 2.5,
  critics: 4.0,
};

const IN = 0.3;
const OUT = 0.5;

function windowOpacity(vt, start, end) {
  if (vt < start || vt >= end) return 0;
  return Math.max(0, Math.min(1, (vt - start) / IN, (end - vt) / OUT));
}

/**
 * The verdict bubbles, staggered so never more than a handful show at once.
 * Only tiers that speak get a bubble (applause / nod / headshake / popcorn);
 * "stands" says nothing and "left" is an empty seat.
 */
export function buildVerdictBubbles(people) {
  const speakers = people.filter((p) => p.verdictLine);
  return speakers.map((p, idx) => {
    const start = VERDICT.bubbles + idx * 0.38; // staggered in waves
    return { personId: p.id, text: p.verdictLine, start, end: start + 1.9 };
  });
}

/** Bubbles visible at verdict-time vt, with fade. Capped for readability. */
export function activeVerdictBubbles(schedule, vt) {
  const out = [];
  for (const e of schedule) {
    const opacity = windowOpacity(vt, e.start, e.end);
    if (opacity > 0.02) out.push({ ...e, opacity });
  }
  return out.slice(0, 6); // never more than six on screen
}

/**
 * Popcorn throw for a popcorn-tier person: a short arc of dots toward the
 * screen. Progress 0..1 over ~1.2s from the popcorn cue; null when inactive.
 */
export function popcornProgress(vt) {
  const p = (vt - VERDICT.popcorn) / 1.2;
  if (p < 0 || p > 1) return null;
  return p;
}
