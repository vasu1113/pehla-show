/**
 * NX1 — placeholder audience data for the Track-B prototype audience layer.
 *
 * Thirty people arrive, take seats, and carry an initial expectation (from the
 * trailer / what little they know of the show). This stands in for Track A's
 * hand-tuned theatre + Track C's profiles — replaced at wire-in (B8).
 */

export const LISTENER_TYPES = [
  'COMMUTER',
  'NIGHT RIDER',
  'SLEEP LISTENER',
  'DEVOTEE',
  'CHANNEL SURFER',
  'FAMILY',
];

// What people mutter to themselves as they sit down. Real register, short.
const EXPECTATIONS = [
  'Heard the first episode drags.',
  'Just something for the ride home.',
  'If it is slow I am out in ten.',
  'The lead was good last serial.',
  'Saw the poster. Looks grim.',
  'People at work will not shut up about it.',
  'Hope it is not another saas-bahu thing.',
  'Give me one good cliffhanger.',
  'I fall asleep to these, no offence.',
  'The promo music was nice.',
  'My sister said skip to episode three.',
  'Two stops of timepass, that is all.',
  'Better than the news at least.',
  'Everyone cried at the end, apparently.',
  'I will give it fifteen minutes.',
  'Same director as that flop.',
];

/** Thirty seats laid out as a small raked auditorium, positions in %. */
export function generateSeats(rows = 5, cols = 6) {
  const seats = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    const top = 24 + r * 14; // front row near the screen, back rows toward viewer
    const scale = 0.62 + r * 0.12; // perspective: nearer rows are larger
    const spread = 8.5 + r * 1.6; // nearer rows are wider
    for (let c = 0; c < cols; c++) {
      const off = c - (cols - 1) / 2;
      const left = 50 + off * spread;
      seats.push({ id: id++, row: r, col: c, left, top, scale });
    }
  }
  return seats;
}

export function generateAudience() {
  const seats = generateSeats();
  return seats.map((s, i) => {
    const delay = 0.1 + ((i * 7) % 30) * 0.06; // staggered arrivals, ~0.1–1.8s
    return {
      id: s.id,
      row: s.row,
      type: LISTENER_TYPES[i % LISTENER_TYPES.length],
      expectation: EXPECTATIONS[(i * 3) % EXPECTATIONS.length],
      // Only a few voice a thought on the way in — kept sparse for readability.
      // ~4 of 30, spread across the rows.
      showsBubble: i % 7 === 2,
      // final seat (fl/ft) and where they walk in from (sl/st), in %.
      fl: s.left,
      ft: s.top,
      sl: 50,
      st: 112,
      scale: s.scale,
      tone: 0.78 + s.row * 0.05, // nearer rows read a touch stronger
      // individuality: hair weighted toward plain, plus skin + clothing variants
      hair: [0, 0, 1, 2, 3, 0, 4, 1, 2, 0][i % 10],
      skin: (i * 3) % 4,
      cloth: (i * 5) % 5,
      delay,
      bubbleDelay: delay + 1.5, // bubble pops after they have settled
    };
  });
}
