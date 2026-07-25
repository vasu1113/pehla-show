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

// x = position along the balcony (%). The two who disagree on the cliff
// (S. RAO structure, id 0; IMTIAZ pacing, id 1) sit at OPPOSITE ends so their
// argument reads as two ends of the room, and their notes never collide.
export const CRITICS = [
  { id: 0, name: 'S. RAO', lens: 'STRUCTURE', x: 14 },
  { id: 1, name: 'IMTIAZ B.', lens: 'PACING', x: 86 },
  { id: 2, name: "MRS. D'SOUZA", lens: 'CHANNEL', x: 50 },
  { id: 3, name: 'K. VELU', lens: 'CHARACTER', x: 32 },
  { id: 4, name: 'A. JOSEPH', lens: 'CULTURE', x: 68 },
];

// { critic, chunk index, seconds into the chunk, duration, text }.
const NOTES = [
  { critic: 2, chunk: 0, at: 12, dur: 5.5,
    text: 'Scene 1 opens on a held silence. On air, the remote comes out right here.' },
  { critic: 3, chunk: 2, at: 14, dur: 5.5,
    text: 'Scene 3: Ramesh asks for the money, but we never learn what he fears. The want is blank.' },
  { critic: 0, chunk: 4, at: 16, dur: 6,
    text: 'Scene 5, the second ledger, is the true inciting incident — and it lands two scenes late.' },
  { critic: 4, chunk: 5, at: 12, dur: 5.5,
    text: 'Scene 6 makes the debt communal. That is the show’s real spine, not the rent.' },
  // --- the disagreement, on THE CLIFF (scene 7), overlapping in time ---
  { critic: 1, chunk: 6, at: 7, dur: 7,
    text: 'Scene 7’s cut to black earns the act break. Hold your nerve and keep it.' },
  { critic: 0, chunk: 6, at: 8.5, dur: 7,
    text: 'Disagree — scene 7’s cliff is unearned. Nothing in 5 or 6 says who is at that door.' },
  // ---------------------------------------------------------------------
  { critic: 1, chunk: 8, at: 22, dur: 6,
    text: 'Scene 9 holds silence for nearly a minute. Brave on film, fatal on television.' },
  { critic: 0, chunk: 10, at: 12, dur: 6,
    text: 'Scene 11 is the peak. Everything after has to fall faster than this script lets it.' },
  { critic: 2, chunk: 13, at: 14, dur: 6,
    text: 'Scene 14 ends on a refusal. Bold — but there is no hook to pull them back next week.' },
];

export function buildCriticSchedule(timed) {
  return NOTES.map((n, i) => {
    const c = timed[n.chunk];
    const start = c.start + n.at;
    const end = Math.min(c.end - 0.2, start + n.dur);
    return { id: i, criticId: n.critic, chunkIndex: n.chunk, text: n.text, start, end };
  }).filter((e) => e.end > e.start + 1);
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
