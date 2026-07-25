/**
 * NX1 — placeholder audience data for the Track-B prototype audience layer.
 *
 * Thirty people arrive, take seats, and carry an initial expectation (from the
 * trailer / what little they know of the show). This stands in for Track A's
 * hand-tuned theatre + Track C's profiles — replaced at wire-in (B8).
 */

// The six cohort ids from the frozen contract, in contract order. These are
// not display strings — /personas, every drop event and every tooltip key off
// them, so a prettier name here would silently stop matching the API. Human
// copy comes from GET /personas; the UI never invents it.
export const LISTENER_TYPES = [
  'commuter',
  'kitchen',
  'night_rider',
  'metro_pro',
  'sleep',
  'diaspora',
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

// B6 verdict tier per person (placeholder for real patience data). The mix
// guarantees several tiers on screen at once and at least one popcorn-thrower.
const VERDICT_LINES = {
  applause: ['Paisa vasool.', 'Wah, kya baat.', 'That ending!', 'Loved it.'],
  nod: ['Not bad.', 'Decent enough.', 'Time pass.', 'Okay-ish.'],
  headshake: ['What was that.', 'Waste of time.', 'Predictable.', 'Nahi yaar.'],
  popcorn: ['Rubbish!', 'Booo!', 'Refund!'],
  stands: [], // stands up, says nothing
  left: [], // empty seat — their absence is the review
};

function verdictTier(i) {
  if (i % 9 === 4) return 'left';
  if (i % 13 === 3) return 'popcorn';
  if (i % 11 === 6) return 'stands';
  if (i % 7 === 2) return 'headshake';
  if (i % 5 === 0) return 'applause';
  return 'nod';
}

export function generateAudience() {
  const seats = generateSeats();
  return seats.map((s, i) => {
    const delay = 0.1 + ((i * 7) % 30) * 0.06; // staggered arrivals, ~0.1–1.8s
    const tier = verdictTier(i);
    const pool = VERDICT_LINES[tier];
    return {
      verdict: tier,
      verdictLine: pool.length ? pool[i % pool.length] : '',
      id: s.id,
      row: s.row,
      col: s.col, // Track A's walkout uses this to pick the exit direction
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
      // a little variety so the crowd reads as different people
      hair: [0, 1, 2, 3, 0, 2, 1, 0, 3, 1][i % 10],
      delay,
      bubbleDelay: delay + 1.5, // bubble pops after they have settled
    };
  });
}
