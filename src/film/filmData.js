/**
 * Placeholder film data for B5. Each chunk is one "still" on the screen.
 *
 * This stands in for real script analysis (Track C). Later, each chunk gains an
 * `imageUrl` (a generated 1970s-Indian-cinema still) and the FilmStrip renders
 * that instead of the fallback card — nothing else changes.
 *
 *   type     — the chunk's role, shown in small caps on the fallback card
 *   line     — one line of the chunk's text, shown on the fallback card
 *   tension  — 0..1, drives how bright the screen glows on this chunk
 *   duration — seconds this still is on screen
 *   imageUrl — optional; when present the still shows the image, not the card
 */
export const FILM_CHUNKS = [
  { id: 'c01', type: 'COLD OPEN', tension: 0.35, duration: 34,
    line: 'A platform at night. The last local has not come.',
    script: 'INT. DADAR STATION — NIGHT. The board still says the 11:52 is due. It is 12:20. MEENA sits on her steel trunk, the only person left under the tin roof. A dog crosses the tracks and does not hurry.' },
  { id: 'c02', type: 'SETUP', tension: 0.28, duration: 42,
    line: 'She counts the money twice. It is still short.',
    script: 'She opens the cloth purse in her lap and counts the notes. Counts them again. Folds them small. The rent is due Monday and the sum in her hand does not become larger for being looked at.' },
  { id: 'c03', type: 'THE ASK', tension: 0.55, duration: 38,
    line: 'One more month, he says. Just one.',
    script: 'RAMESH (V.O.): One more month, Meena. Just one. He had said it standing in the doorway, not coming in, the way a man says a thing he has already decided you will agree to.' },
  { id: 'c04', type: 'PUSHBACK', tension: 0.62, duration: 30,
    line: 'The landlord does not sit down.',
    script: 'INT. TENEMENT ROOM — DAY. The landlord does not sit down. He looks at the walls as if pricing them. "Three families would take this room," he says, "and none of them would argue."' },
  { id: 'c05', type: 'THE TURN', tension: 0.78, duration: 46,
    line: 'She finds the second ledger behind the rice.',
    script: 'Behind the rice tin, wrapped in an old sari, a second ledger. Not the one the collector sees. This one is in her husband’s hand, and every page is a name and a number and a date that has not yet come.' },
  { id: 'c06', type: 'RISING', tension: 0.7, duration: 40,
    line: 'Every name in it owes the same man.',
    script: 'She reads down the column. Kulkarni. Shaikh. The widow on the third floor. Every name in the book owes the same man, and the same man owns the roof over each of their heads.' },
  { id: 'c07', type: 'THE CLIFF', tension: 0.95, duration: 28,
    line: 'Headlights fill the doorway. Nobody moves.',
    script: 'Headlights swing across the wall and hold. A car has stopped in the lane below, engine running. Meena closes the ledger. On the stairs, a single slow footstep. Nobody in the room moves. CUT TO BLACK.' },
  { id: 'c08', type: 'AFTERMATH', tension: 0.4, duration: 44,
    line: 'Morning. The tea has gone cold on the step.',
    script: 'INT. ROOM — MORNING. Grey light. The tea has gone cold on the step where she left it. The ledger is gone from the shelf. Meena sits exactly where she was, and has not slept.' },
  { id: 'c09', type: 'QUIET', tension: 0.22, duration: 50,
    line: 'The fan turns. No one has spoken in an hour.',
    script: 'The ceiling fan turns on its slow wobble. Her daughter does homework on the floor without asking anything. No one has spoken in an hour. Outside, the vegetable seller calls the same three prices he calls every day.' },
  { id: 'c10', type: 'THE RETURN', tension: 0.66, duration: 36,
    line: 'He comes back with the ledger under his arm.',
    script: 'Ramesh comes up the stairs with the ledger under his arm as if returning a borrowed thing. "You should not have this," he says. She says nothing, which is worse.' },
  { id: 'c11', type: 'CONFRONTATION', tension: 0.9, duration: 32,
    line: 'You knew, she says. You always knew.',
    script: 'MEENA: You knew. You wrote the names down and you knew. RAMESH: I kept the book so someone would. MEENA: You kept the book so he would trust you. That is not the same thing and you know it is not.' },
  { id: 'c12', type: 'FALLOUT', tension: 0.5, duration: 40,
    line: 'The neighbours pretend not to watch.',
    script: 'EXT. LANDING — CONTINUOUS. Doors along the landing are open a hand’s width. The neighbours pretend not to watch and do not miss a word. Meena walks past all of them without lowering her eyes.' },
  { id: 'c13', type: 'THE PLAN', tension: 0.6, duration: 38,
    line: 'If we go to the collector, we go together.',
    script: 'INT. WIDOW’S ROOM — NIGHT. Six of them, and one lamp. "If we go to the collector," Meena says, "we go together, and we go with the book. One name he can bury. Six names on a roll is a different problem."' },
  { id: 'c14', type: 'CODA', tension: 0.3, duration: 42,
    line: 'The last local, finally. She does not get on.',
    script: 'EXT. PLATFORM — NIGHT. The last local, finally, sighs to a stop. The doors stand open in front of her. Meena looks at the lit carriage a long moment, and does not get on. She turns back toward the lane. FADE OUT.' },
];

/** Cumulative start time of each chunk, plus the film's total length. */
export function buildTimeline(chunks) {
  let acc = 0;
  const timed = chunks.map((c) => {
    const start = acc;
    acc += c.duration;
    return { ...c, start, end: acc };
  });
  return { timed, total: acc };
}

/** Which chunk is playing at time t. The single source of chunk truth so the
 *  film and any other reader (the readout, later the script pane) always agree. */
export function chunkAtTime(timed, t) {
  if (timed.length === 0) return { index: -1, chunk: null };
  const lastEnd = timed[timed.length - 1].end;
  const clamped = Math.max(0, Math.min(t, lastEnd - 0.0001));
  let index = timed.findIndex((c) => clamped >= c.start && clamped < c.end);
  if (index === -1) index = timed.length - 1;
  return { index, chunk: timed[index] };
}
