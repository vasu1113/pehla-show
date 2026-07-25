/**
 * THE ANALYSIS BACKBONE — a per-person patience simulation.
 *
 * This is the derivable-insight engine: it turns each listener's per-chunk
 * patience into retention, drop-off, attention and per-segment reads. It is a
 * placeholder for Track A/C's real patience data, but it is the SINGLE source
 * the charts read — and later the on-screen walkouts + verdict will read it too,
 * so the seats and the lines can never disagree.
 *
 * Everything is a deterministic function of (person, chunk tension), so it is
 * stable across renders and reproducible.
 */
import { LISTENER_TYPES } from '../audience/audienceData.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// How each listener type's patience responds to a chunk.
//   start      — where their patience begins
//   base       — passive drift each chunk
//   likesRising— reward for tension rising vs the previous chunk
//   hatesQuiet — penalty when a chunk is too calm (this value is negative)
//   tol        — general staying power (cushions drops)
const PROFILES = {
  COMMUTER: { start: 0.68, base: -0.03, likesRising: 0.3, hatesQuiet: -0.34, tol: 0.0 },
  'NIGHT RIDER': { start: 0.82, base: 0.0, likesRising: 0.22, hatesQuiet: -0.06, tol: 0.16 },
  'SLEEP LISTENER': { start: 0.5, base: -0.055, likesRising: -0.04, hatesQuiet: 0.08, tol: -0.08 },
  DEVOTEE: { start: 0.86, base: 0.02, likesRising: 0.12, hatesQuiet: 0.04, tol: 0.26 },
  'CHANNEL SURFER': { start: 0.54, base: -0.07, likesRising: 0.34, hatesQuiet: -0.4, tol: -0.16 },
  FAMILY: { start: 0.7, base: -0.02, likesRising: 0.14, hatesQuiet: -0.14, tol: 0.05 },
};

// deterministic per-key jitter in [-0.5, 0.5]
function jitter(key) {
  return ((key * 9301 + 49297) % 233280) / 233280 - 0.5;
}

function simulatePerson(p, timed) {
  const prof = PROFILES[p.type] || PROFILES.FAMILY;
  let patience = clamp01(prof.start + jitter(p.id + 1) * 0.2);
  const series = [];
  let walkoutIndex = null;
  let walkoutTime = null;
  let prevTension = timed[0].tension;

  for (let i = 0; i < timed.length; i++) {
    const c = timed[i];
    if (walkoutIndex !== null) {
      series.push(0);
      continue;
    }
    const rising = c.tension - prevTension;
    const quiet = Math.max(0, 0.34 - c.tension); // how calm this chunk is
    const tooTense = Math.max(0, c.tension - 0.85); // overwhelming

    let delta =
      prof.base +
      prof.likesRising * rising +
      prof.hatesQuiet * (quiet * 2) +
      prof.tol * 0.02 -
      (p.type === 'SLEEP LISTENER' ? 0.15 * tooTense : 0);
    delta += jitter(p.id * 7 + i + 1) * 0.06;

    patience = clamp01(patience + delta);
    if (patience <= 0.001) {
      walkoutIndex = i;
      walkoutTime = c.start + Math.min(c.duration * 0.5, 2);
      patience = 0;
    }
    series.push(patience);
    prevTension = c.tension;
  }

  return {
    id: p.id,
    type: p.type,
    series,
    walkoutIndex,
    walkoutTime,
    finalPatience: series[series.length - 1] ?? 0,
    stayed: walkoutIndex === null,
  };
}

export function runSimulation(people, timed) {
  return people.map((p) => simulatePerson(p, timed));
}

/** Fraction of the room still present at time t. */
export function retentionAt(sims, t) {
  if (sims.length === 0) return 1;
  const present = sims.filter((s) => s.walkoutTime === null || s.walkoutTime > t).length;
  return present / sims.length;
}

/** Retention step-series at each chunk boundary (for the curve). */
export function retentionSeries(sims, timed) {
  const points = [{ t: 0, value: 1 }];
  for (const c of timed) points.push({ t: c.end, value: retentionAt(sims, c.end) });
  return points;
}

/** Per-listener-type retention step-series (for the small multiples). */
export function retentionByType(sims, timed) {
  return LISTENER_TYPES.map((type) => {
    const grp = sims.filter((s) => s.type === type);
    const points = [{ t: 0, value: 1 }];
    for (const c of timed) {
      const present = grp.filter((s) => s.walkoutTime === null || s.walkoutTime > c.end).length;
      points.push({ t: c.end, value: grp.length ? present / grp.length : 0 });
    }
    return { type, points, n: grp.length };
  });
}

/** Average patience of the people still present — the "attention" signal. */
export function attentionSeries(sims, timed) {
  return timed.map((c, i) => {
    const present = sims.filter((s) => s.walkoutIndex === null || s.walkoutIndex > i);
    const avg = present.length ? present.reduce((a, s) => a + s.series[i], 0) / present.length : 0;
    return { t: c.end, value: avg };
  });
}

/** Walkout events grouped by the chunk they happened in (the drop-off cliffs). */
export function walkoutEvents(sims, timed) {
  const byChunk = {};
  for (const s of sims) {
    if (s.walkoutIndex !== null) (byChunk[s.walkoutIndex] ||= []).push(s);
  }
  return Object.entries(byChunk)
    .map(([ci, arr]) => {
      const c = timed[+ci];
      return {
        chunkIndex: +ci,
        chunkType: c.type,
        time: c.start + Math.min(c.duration * 0.5, 2),
        count: arr.length,
        types: [...new Set(arr.map((a) => a.type))],
      };
    })
    .sort((a, b) => a.time - b.time);
}

/** The headline numbers a stakeholder acts on. */
export function analysisMetrics(sims, timed) {
  const n = sims.length;
  const stayed = sims.filter((s) => s.stayed).length;
  const events = walkoutEvents(sims, timed);
  const biggest = events.slice().sort((a, b) => b.count - a.count)[0] || null;

  const perType = LISTENER_TYPES.map((type) => {
    const grp = sims.filter((s) => s.type === type);
    const kept = grp.filter((s) => s.stayed).length;
    return { type, retention: grp.length ? kept / grp.length : 0, n: grp.length };
  }).filter((x) => x.n > 0);

  const best = perType.slice().sort((a, b) => b.retention - a.retention)[0];
  const worst = perType.slice().sort((a, b) => a.retention - b.retention)[0];
  const verdict = stayed / n >= 0.66 ? 'WORKS' : stayed / n >= 0.45 ? 'MIXED' : 'LOSES THE ROOM';

  return { n, stayed, finalRetention: stayed / n, biggest, perType, best, worst, verdict };
}
