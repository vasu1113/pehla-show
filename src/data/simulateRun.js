import baseRun from '../../public/data/mockRun.json';

/**
 * CLIENT-SIDE VARIATION — make the analytics respond to WHO is watching.
 *
 * We can't parse arbitrary script text without the backend, so the beat/tension
 * structure stays the sample's. But the audience response — who leaves, when,
 * and the whole retention/attention picture — is re-derived from the six chosen
 * personas' traits (attention_span, trope_appetite). Different casts → different
 * analytics. Deterministic: same cast in, same run out.
 *
 * Model: each persona has a leave-pressure from its traits; we roll it per seat
 * so a cohort of five splits smoothly (not all-or-nothing), pick a trough beat
 * for each leaver, and synthesise a patience trace to match. When the backend is
 * up this whole file is replaced by POST /analyse; the Run shape matches.
 */

const SPAN = { short: 0, medium: 1, long: 2 };
const APP = { low: 0, medium: 1, high: 2 };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;
// well-distributed deterministic 0..1 from any key
const frac = (k) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const beatById = new Map(baseRun.beats.map((b) => [b.id, b]));
// the beats people actually bail on — troughs and exposition/setup
const troughs = baseRun.beats
  .map((b, i) => ({ b, i }))
  .filter((x) => x.b.tension_delta < 0 || x.b.type === 'exposition' || x.b.type === 'setup');

const REASON = {
  exposition: ['EXPOSITION_STACK', 'Exposition with no open question'],
  setup: ['NO_OPEN_QUESTION', 'A scene that opens nothing'],
  banter: ['PACING_FLAT', 'Banter with the plot on pause'],
  conflict: ['STAKES_TOO_LOW', 'Conflict without stakes'],
  action: ['PACING_FLAT', 'Motion that does not turn the story'],
  reveal: ['PAYOFF_TOO_FAR', 'A payoff that arrives too late'],
  cliffhanger: ['PAYOFF_TOO_FAR', 'Tension held past its welcome'],
};
const reasonForBeat = (b) => {
  const [code, label] = REASON[b?.type] ?? ['PACING_FLAT', 'Attention drifted'];
  return { code, label };
};

// fraction of a cohort expected to leave, from the two traits
function leavePressure(persona) {
  const span = SPAN[persona.attention_span] ?? 1;
  const app = APP[persona.trope_appetite] ?? 1;
  let lp = [0.76, 0.46, 0.18][span]; // short bail a lot, long rarely
  lp += app === 0 ? 0.12 : app === 2 ? -0.1 : 0; // low trope-appetite bails more
  return clamp(lp, 0.04, 0.94);
}

function startPatience(persona, seat) {
  const span = SPAN[persona.attention_span] ?? 1;
  return clamp(4.2 + span * 0.7 + (frac(seat * 1.3 + 0.9) - 0.5) * 1.0, 2, 6);
}

// a coherent per-beat patience curve; hits 0 at the leave beat, else oscillates
function traceFor(start, beats, leftIdx) {
  const trace = [round2(start)];
  if (leftIdx === null) {
    let p = start;
    for (const b of beats) {
      const td = b.tension_delta;
      p = clamp(p + (td < 0 ? 0.18 * td : 0.14 * td) - 0.01, 1.2, 6);
      trace.push(round2(p));
    }
  } else {
    for (let i = 0; i < beats.length; i++) {
      trace.push(i < leftIdx ? round2(Math.max(0, start * (1 - (i + 1) / (leftIdx + 1)))) : 0);
    }
  }
  return trace;
}

export function simulateRun(personas) {
  const chosen = personas.filter(Boolean).slice(0, 6);
  const beats = baseRun.beats;
  const audience = [];
  const cohorts = [];

  chosen.forEach((persona, ci) => {
    const lp = leavePressure(persona);
    let retained = 0;
    for (let s = 0; s < 5; s++) {
      const seat = ci * 5 + s;
      const leaves = frac(seat * 1.7 + 0.31) < lp;
      const leftIdx = leaves
        ? troughs[Math.floor(frac(seat * 2.3 + 9.1) * troughs.length)].i
        : null;
      const start = startPatience(persona, seat);
      const trace = traceFor(start, beats, leftIdx);
      const beat = leftIdx != null ? beats[leftIdx] : null;
      const reason = beat ? reasonForBeat(beat) : null;
      if (leftIdx === null) retained += 1;
      audience.push({
        seat,
        cohort: persona.id,
        persona_id: persona.id,
        variant_index: s,
        name: `${persona.label} #${s + 1}`,
        start_patience: trace[0],
        left_at_sec: beat ? beat.start_sec + Math.min((beat.end_sec - beat.start_sec) * 0.5, 4) : null,
        left_at_beat: beat ? beat.id : null,
        reason_code: reason?.code ?? null,
        reason_label: reason?.label ?? null,
        evidence: beat?.text_span ?? null,
        patience_trace: trace,
      });
    }
    cohorts.push({
      id: persona.id,
      label: persona.label,
      context: persona.prompt ?? '',
      seat_count: 5,
      retained_pct: retained / 5,
    });
  });

  const byBeat = {};
  for (const m of audience) {
    if (m.left_at_beat != null) (byBeat[m.left_at_beat] ||= []).push(m);
  }
  const drop_events = Object.entries(byBeat)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([beatId, members], i) => {
      const b = beatById.get(Number(beatId));
      const { code, label } = reasonForBeat(b);
      const cohort_breakdown = {};
      for (const m of members) cohort_breakdown[m.cohort] = (cohort_breakdown[m.cohort] || 0) + 1;
      return {
        id: `de_${i}`,
        timestamp: b.start_sec + Math.min((b.end_sec - b.start_sec) * 0.5, 4),
        beat_id: Number(beatId),
        seats_lost: members.map((m) => m.seat).sort((x, y) => x - y),
        cohort_breakdown,
        reason_code: code,
        reason_label: label,
        evidence: b.text_span,
        kind: Object.keys(cohort_breakdown).length > 1 ? 'structural' : 'taste_split',
      };
    });

  const seats_retained = audience.filter((m) => m.left_at_sec == null).length;
  const cohort_retention = {};
  for (const c of cohorts) cohort_retention[c.id] = c.retained_pct;
  const ranked = drop_events.slice().sort((a, b) => b.seats_lost.length - a.seats_lost.length);

  return {
    ...baseRun,
    run_id: `sim_${chosen.map((p) => p.id).join('-')}`,
    variant: 'original',
    cohorts,
    audience,
    drop_events,
    summary: {
      ...baseRun.summary,
      seats_total: 30,
      seats_retained,
      retained_pct: seats_retained / 30,
      cohort_retention,
      top_losses: ranked.slice(0, 3).map((d) => ({
        timestamp: d.timestamp,
        seats_lost: d.seats_lost.length,
        reason_label: d.reason_label,
      })),
      biggest_cliff_sec: ranked[0]?.timestamp ?? null,
    },
  };
}
