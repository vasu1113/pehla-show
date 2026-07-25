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

// The critics' INITIAL opinions — pre-film takes, before a single scene plays.
// Staggered at the very start; the first is visible even while paused at 0.
const INITIALS = [
  { critic: 0, text: 'Promo sold a thriller. Structurally, thrillers live or die in act one.' },
  { critic: 1, text: 'Ninety seconds to hook me. A serial gets less.' },
  { critic: 2, text: 'Friday slot. It has to hold a distracted living room.' },
  { critic: 3, text: 'Give me one person I understand in the first scene.' },
  { critic: 4, text: 'Another debt drama. Show me why this one is different.' },
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
  // --- the disagreement, on THE CLIFF (scene 7), overlapping in time ---
  { critic: 1, chunk: 6, at: 1.2, dur: 3.6,
    text: 'Scene 7’s cut to black earns the act break. Keep it.' },
  { critic: 0, chunk: 6, at: 2, dur: 3.4,
    text: 'Disagree — scene 7’s cliff is unearned. Nothing sets up who is at the door.' },
  // ---------------------------------------------------------------------
  { critic: 1, chunk: 8, at: 3, dur: 3.2,
    text: 'Scene 9 holds its silence too long for television.' },
  { critic: 0, chunk: 10, at: 2, dur: 3.2,
    text: 'Scene 11 is the peak. The fall after it is too slow.' },
  { critic: 2, chunk: 13, at: 2, dur: 3.2,
    text: 'Scene 14 ends on a refusal. Bold — but no hook for next week.' },
];

export function buildCriticSchedule(timed) {
  const events = [];
  let uid = 0;

  // Initial opinions, staggered near the start (first one starts before 0 so
  // it is already visible when the clock sits paused at 0).
  INITIALS.forEach((n, i) => {
    const start = -0.6 + i * 1.8;
    events.push({ id: uid++, criticId: n.critic, text: n.text, start, end: start + 2.8, initial: true });
  });

  // In-film analytical notes.
  NOTES.forEach((n) => {
    const c = timed[n.chunk];
    const start = c.start + n.at;
    const end = Math.min(c.end - 0.1, start + n.dur);
    if (end > start + 0.8) {
      events.push({ id: uid++, criticId: n.critic, chunkIndex: n.chunk, text: n.text, start, end });
    }
  });

  return events;
}

/** Active critic notes at time t — at most one per critic (so the balcony never
 *  stacks two bubbles on one seat), but different critics CAN overlap (that is
 *  how the disagreement shows). Pure function of the clock → scrub-exact. */
export function activeCriticNotes(schedule, t) {
  const byCritic = new Map();
  for (const e of schedule) {
    if (t >= e.start && t < e.end) byCritic.set(e.criticId, e);
  }
  const out = [];
  for (const e of byCritic.values()) {
    out.push({ event: e, opacity: thoughtOpacity(e, t) });
  }
  return out;
}
