/**
 * NX2 — live thoughts during the film.
 *
 * ⚠️ This deliberately deviates from spec B6 ("no words while the film plays").
 * User override, kept restrained: a handful at a time, short, staggered, and
 * fading — a room murmuring, not a chatroom.
 *
 * Each thought is a TIME WINDOW. Visibility and fade are pure functions of the
 * clock, so scrubbing to any moment shows exactly the right thoughts — no timers.
 *
 * Reactions are keyed to the chunk's mood (a stand-in for real per-person
 * patience movement, which arrives with Track A/C data later).
 */

// What people mutter when the film has them.
const TENSE = ['Oh no.', 'Do not open it.', 'He is right there.', 'Uff.', 'My heart.'];
const ENGAGED = ['Now we are talking.', 'Achha, twist.', 'Oho.', 'Finally.', 'Kya scene hai.'];
const NEUTRAL = ['Hmm.', 'Okay okay.', 'Chalo.', 'Theek hai.'];
const BORED = ['Get on with it.', 'Kitna slow hai.', 'Checked my phone.', 'Boring yaar.', 'Still nothing.'];

function poolForChunk(chunk, prev) {
  if (chunk.tension >= 0.85) return TENSE;
  if (chunk.tension <= 0.3) return BORED;
  if (prev && chunk.tension > prev.tension + 0.05) return ENGAGED;
  return NEUTRAL;
}

/**
 * Build the whole film's thought schedule from the timed chunks.
 * A couple of reactors per chunk, staggered within it, ~3s each.
 */
export function buildThoughtSchedule(timed, peopleCount) {
  const events = [];
  let uid = 0;
  timed.forEach((c, ci) => {
    const prev = ci > 0 ? timed[ci - 1] : null;

    // The crowd only reacts on NOTABLE beats — a clear emotional signal:
    // high tension, boredom, or a big swing from the previous chunk. Most
    // chunks pass in silence, so the room stays readable.
    const swing = prev ? Math.abs(c.tension - prev.tension) : 0;
    const notable = c.tension >= 0.72 || c.tension <= 0.3 || swing >= 0.2;
    if (!notable) return;

    const pool = poolForChunk(c, prev);
    const clusterSize = 1 + (ci % 2); // 1 or 2 people, never a crowd
    const base = c.start + c.duration * 0.4;
    for (let k = 0; k < clusterSize; k++) {
      const personId = (ci * 7 + k * 11) % peopleCount;
      const text = pool[(ci * 3 + k) % pool.length];
      const start = base + k * 0.5;
      const end = Math.min(c.end - 0.1, start + 2.4);
      if (end > start + 0.6) events.push({ id: uid++, personId, text, start, end });
    }
  });
  return events;
}

/** Fade a thought in/out inside its window; 0..1, computed from the clock. */
export function thoughtOpacity(event, t) {
  if (t < event.start || t >= event.end) return 0;
  const IN = 0.35;
  const OUT = 0.6;
  const fadeIn = Math.min(1, (t - event.start) / IN);
  const fadeOut = Math.min(1, (event.end - t) / OUT);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

/**
 * The thoughts visible at time t, at most one per person (so no seat ever
 * stacks two bubbles). Returns [{ event, opacity }].
 */
export function activeThoughts(schedule, t) {
  const byPerson = new Map();
  for (const e of schedule) {
    if (t >= e.start && t < e.end) byPerson.set(e.personId, e); // last wins
  }
  const out = [];
  for (const e of byPerson.values()) {
    out.push({ event: e, opacity: thoughtOpacity(e, t) });
  }
  return out;
}
