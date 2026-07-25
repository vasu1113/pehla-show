// ─────────────────────────────────────────────────────────────
// THE PEOPLE
// Thirty figures that must not look like thirty copies.
//
// Every varying property is derived arithmetically from the seat
// number, so a person looks the same on every render, on every
// reload, and at every point on the scrubber. Nothing here calls
// Math.random() — a figure that changes shape when you scrub
// backwards destroys the illusion instantly.
// ─────────────────────────────────────────────────────────────

// Cheap deterministic hash. Same seat in, same value out, forever.
function noise(seat, salt) {
  const x = Math.sin(seat * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

export const SILHOUETTES = ['plain', 'ponytail', 'cap', 'broad', 'hunched'];

export function figureFor(seat) {
  return {
    // ±8%. Enough to read as different people, not enough to read as a bug.
    heightScale: 0.92 + noise(seat, 1) * 0.16,

    // 2–3px off centre. Nobody sits exactly in the middle of a seat.
    dx: (noise(seat, 2) - 0.5) * 5.5,

    silhouette: SILHOUETTES[Math.floor(noise(seat, 3) * SILHOUETTES.length)],

    // Everyone breathes, nobody breathes together. This is the highest
    // ratio of charm to effort in the whole project.
    breathPhase: noise(seat, 4) * Math.PI * 2,
    breathPeriod: 3.4 + noise(seat, 5) * 1.4, // seconds per breath

    // Which way they shuffle out. Left half exits left, right half right.
    exitDir: (seat % 6) < 3 ? -1 : 1,
  };
}

// ─── The exit, and why these numbers are what they are ───────────────
//
// EXIT_DURATION 1.25s: long enough to read as a person deciding to
// leave, short enough that five of them don't clog the aisle.
//
// STAGGER 0.2s per seat: MANDATORY. Five people vanishing on the same
// frame looks like a rendering bug. Five trickling out across a second
// looks like a crowd losing interest. This single number decides
// whether the room feels alive.

export const EXIT_DURATION = 1.25;
export const STAGGER = 0.2;

export function exitStartFor(seat, leftAtSec) {
  if (leftAtSec == null) return null;
  return leftAtSec + (seat % 5) * STAGGER;
}

// Three states, worked out from one number. The component keeps no
// timer of its own — feed it 240 and it shows four minutes; feed it
// 120 and everyone walks back in. On stage the scrubber gets dragged
// backwards and the walkout replayed while talking over it, and that
// only works if this function has no memory.
export function stateFor(seat, leftAtSec, currentTime) {
  const start = exitStartFor(seat, leftAtSec);
  if (start == null || currentTime < start) return { state: 'here', t: 0 };

  const t = (currentTime - start) / EXIT_DURATION;
  if (t >= 1) return { state: 'gone', t: 1 };
  return { state: 'leaving', t };
}

// Ease-out: they stand up quickly and drift away. Linear reads robotic.
export function ease(t) {
  return 1 - Math.pow(1 - t, 2.2);
}
