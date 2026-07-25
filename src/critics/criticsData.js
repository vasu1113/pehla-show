/**
 * The critics — "the room that explains". Five personas in the balcony, each
 * reading the film through a different lens (their knowledge + persona is the
 * point). During the film they drop sparse, analytical notes ALONGSIDE the
 * crowd's gut reactions — the live A/B contrast.
 *
 * The written notes come from the completed Run. They are generated against
 * the real script, anchored to a beat, then revealed by the playback clock.
 */
import { thoughtOpacity } from '../audience/thoughtData.js';

// Opera-house horseshoe: critics sit in boxes climbing the side walls.
// `side` = which wall, `row` = 0 is the TOP (highest) box on that wall.
// The two who disagree on the cliff (S. RAO structure, IMTIAZ pacing) sit in
// the TOP boxes on OPPOSITE walls, so their argument reads across the hall.
export const CRITICS = [
  { id: 'director', side: 'left', row: 0 },
  { id: 'editor', side: 'left', row: 1 },
  { id: 'historian', side: 'left', row: 2 },
  { id: 'critic', side: 'right', row: 0 },
  { id: 'psychologist', side: 'right', row: 1 },
];

export function buildCriticSchedule(timed, notes = []) {
  return notes.flatMap((note, index) => {
    const chunk = timed.find((item) => item.beatId === note.beat_id);
    if (!chunk || !note.text || !CRITICS.some((critic) => critic.id === note.agent_id)) return [];
    const start = chunk.start + Math.min(0.5, Math.max(0.12, chunk.duration * (0.16 + (index % 3) * 0.12)));
    const end = Math.min(chunk.end - 0.02, start + 3.6);
    return end > start + 0.35
      ? [{ id: note.id, criticId: note.agent_id, text: note.text, start, end }]
      : [];
  });
}

/** The entire room gets one speaker at a time. Pure function of the clock. */
export function activeCriticNotes(schedule, t) {
  const event = schedule.find((item) => t >= item.start && t < item.end);
  return event ? [{ event, opacity: thoughtOpacity(event, t) }] : [];
}
