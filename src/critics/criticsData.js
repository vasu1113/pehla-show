/**
 * The critics — "the room that explains". Five personas in the balcony, each
 * reading the film through a different lens (their knowledge + persona is the
 * point). During the film they drop sparse, analytical notes ALONGSIDE the
 * crowd's gut reactions — the live A/B contrast.
 *
 * Spec rules honoured: notes are analytical and specific, TWO critics visibly
 * disagree (on the cliff), and every note NAMES a scene.
 *
 * Placeholder text now; the real critic notes come from Track A/C data later.
 */
import { thoughtOpacity } from '../audience/thoughtData.js';

// Opera-house horseshoe: critics sit in boxes climbing the side walls.
// `side` = which wall, `row` = 0 is the TOP (highest) box on that wall.
// The two who disagree on the cliff (S. RAO structure, IMTIAZ pacing) sit in
// the TOP boxes on OPPOSITE walls, so their argument reads across the hall.
export const CRITICS = [
  { id: 0, name: 'S. RAO', lens: 'STRUCTURE', side: 'left', row: 0 },
  { id: 2, name: "MRS. D'SOUZA", lens: 'CHANNEL', side: 'left', row: 1 },
  { id: 4, name: 'A. JOSEPH', lens: 'CULTURE', side: 'left', row: 2 },
  { id: 1, name: 'IMTIAZ B.', lens: 'PACING', side: 'right', row: 0 },
  { id: 3, name: 'K. VELU', lens: 'CHARACTER', side: 'right', row: 1 },
];

// The critics' opening take — one voice at a time; the audience fills the
// silence between analytical observations.
const INITIALS = [
  { critic: 0, text: 'Promo sold a thriller. Structurally, thrillers live or die in act one.' },
];

// In-film notes. { critic, chunk index, seconds into the chunk, duration, text }.
// Offsets are small because the chunks are short now.
const NOTES = [
  { critic: 3, chunk: 2, at: 2, dur: 3.5,
    text: 'Scene 3: Ramesh asks, but we never learn what he fears. The want is blank.' },
  { critic: 0, chunk: 4, at: 2.5, dur: 3.5,
    text: 'Scene 5’s ledger is the true inciting incident — and it lands two scenes late.' },
  { critic: 4, chunk: 5, at: 2, dur: 3.2,
    text: 'Scene 6 makes the debt communal. That is the show’s real spine.' },
  { critic: 1, chunk: 6, at: 3.1, dur: 2.1,
    text: 'Scene 7’s cut to black earns the act break. Keep it.' },
  { critic: 1, chunk: 8, at: 3, dur: 3.2,
    text: 'Scene 9 holds its silence too long for television.' },
  { critic: 0, chunk: 10, at: 2, dur: 3.2,
    text: 'Scene 11 is the peak. The fall after it is too slow.' },
  { critic: 2, chunk: 13, at: 2, dur: 3.2,
    text: 'Scene 14 ends on a refusal. Bold — but no hook for next week.' },
];

// The critics' FINAL reviews, in the verdict (B6). Longer, analytical, and two
// of them (id 1 airs it / id 2 loses the room) visibly disagree on the verdict.
const FINAL_REVIEWS = [
  { critic: 0, text: 'Spine is sound, but act two spends the tension act one banked. A rewrite, not a reshoot.' },
  { critic: 1, text: 'It holds. Trim scene 9 and the back half, and this airs.' },
  { critic: 2, text: 'Too quiet for the Friday slot. It loses the room by the first break.' },
  { critic: 3, text: 'Meena is real; everyone around her is a function. Give the landlord one human beat.' },
  { critic: 4, text: 'The communal-debt read is the whole show. Lean into it and you have something.' },
];

export function buildCriticSchedule(timed) {
  const events = [];
  let uid = 0;
  const total = timed.length ? timed[timed.length - 1].end : 0;

  // Opening take starts with the first frame; no competing voices.
  INITIALS.forEach((n, i) => {
    const start = 0.12 + i * 3.4;
    events.push({ id: uid++, criticId: n.critic, text: n.text, start, end: start + 2.8, initial: true });
  });

  // In-film analytical notes.
  NOTES.forEach((n) => {
    const c = timed[n.chunk];
    // Real scripts can contain fewer beats than the original canned film.
    // Placeholder critic notes have no valid anchor in that case.
    if (!c) return;
    const start = c.start + n.at;
    const end = Math.min(c.end - 0.1, start + n.dur);
    if (end > start + 0.8) {
      events.push({ id: uid++, criticId: n.critic, chunkIndex: n.chunk, text: n.text, start, end });
    }
  });

  // Final reviews, staggered on the verdict tail (critics speak at ~+4s).
  FINAL_REVIEWS.forEach((n, i) => {
    const start = total + 3.9 + i * 0.55;
    events.push({ id: uid++, criticId: n.critic, text: n.text, start, end: start + 2.2, final: true });
  });

  return events;
}

/** The entire room gets one speaker at a time. Pure function of the clock. */
export function activeCriticNotes(schedule, t) {
  const event = schedule.find((item) => t >= item.start && t < item.end);
  return event ? [{ event, opacity: thoughtOpacity(event, t) }] : [];
}
