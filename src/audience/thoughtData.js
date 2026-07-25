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
 * Reactions come from the completed Run. They were generated during the blind
 * audience score, are anchored to a beat and are replayed from the clock.
 */

/**
 * Build a sparse schedule from real cohort reactions. Several cohorts may
 * react to the same beat; show the strongest one so the room stays readable.
 */
export function buildThoughtSchedule(timed, reactions = []) {
  return timed.flatMap((chunk, index) => {
    const candidates = reactions
      .filter((reaction) => reaction.beat_id === chunk.beatId && reaction.text)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.cohort.localeCompare(b.cohort));
    const reaction = candidates[0];
    if (!reaction) return [];
    const start = chunk.start + Math.min(0.5, Math.max(0.12, chunk.duration * 0.2));
    const end = Math.min(chunk.end - 0.02, start + 2.8);
    if (end <= start + 0.35) return [];
    return [{ id: `reaction-${reaction.cohort}-${reaction.beat_id}-${index}`, ...reaction, start, end }];
  });
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
  const event = schedule.find((item) => t >= item.start && t < item.end);
  return event ? [{ event, opacity: thoughtOpacity(event, t) }] : [];
}
