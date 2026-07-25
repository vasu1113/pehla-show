import { useEffect, useState } from 'react';

/**
 * The one Run loader. Every panel reads the same Run from here (mock mode
 * fetches the seeded file; later this swaps for the live API). Cached at module
 * level so thirty consumers cause one fetch.
 */
let cache = null;
let inflight = null;

/**
 * A theatre audience can lose attention without literally walking out. Keep
 * those two signals separate: each original drop retains its full attention
 * impact, while only one representative viewer per drop leaves the room.
 */
export function normalizeRun(rawRun) {
  if (!rawRun?.summary || rawRun.variant === 'theatre-normalized') return rawRun;
  const drops = (rawRun.drop_events ?? []).map((drop) => ({
    ...drop,
    attention_affected: drop.seats_lost,
    seats_lost: drop.seats_lost.slice(0, 1),
  }));
  const exits = new Set(drops.flatMap((drop) => drop.seats_lost));
  const audience = (rawRun.audience ?? []).map((member) => (
    exits.has(member.seat)
      ? member
      : { ...member, left_at_sec: null, left_at_beat: null, reason_code: null, reason_label: null, evidence: null }
  ));
  const seatsTotal = rawRun.summary.seats_total;
  const seatsRetained = seatsTotal - exits.size;
  const cohorts = (rawRun.cohorts ?? []).map((cohort) => {
    const members = audience.filter((member) => member.cohort === cohort.id);
    const retained = members.filter((member) => member.left_at_sec == null).length;
    return { ...cohort, retained_pct: members.length ? retained / members.length : 0 };
  });

  return {
    ...rawRun,
    variant: 'theatre-normalized',
    audience,
    cohorts,
    drop_events: drops,
    summary: {
      ...rawRun.summary,
      retained_pct: seatsRetained / seatsTotal,
      seats_retained: seatsRetained,
      top_losses: drops.map((drop) => ({ timestamp: drop.timestamp, seats_lost: drop.seats_lost.length, reason_label: drop.reason_label })),
    },
  };
}

/**
 * Install a run produced client-side (from the six chosen personas) as the one
 * every panel reads. Called before the screening mounts, so consumers pick it
 * up on mount. Not normalised — the simulator already emits a theatre-ready run.
 */
export function setActiveRun(run) {
  cache = run;
  inflight = Promise.resolve(run);
}

export function useRun() {
  const [run, setRun] = useState(cache);
  const [status, setStatus] = useState(cache ? 'ready' : 'loading');

  useEffect(() => {
    if (cache) {
      setRun(cache);
      setStatus('ready');
      return;
    }
    if (!inflight) {
      inflight = fetch('/data/mockRun.json').then((r) =>
        r.ok ? r.json().then(normalizeRun) : Promise.reject(new Error(String(r.status))),
      );
    }
    let live = true;
    inflight
      .then((d) => {
        cache = d;
        if (live) {
          setRun(d);
          setStatus('ready');
        }
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, []);

  return { run, status };
}

/**
 * The Run's beats/drops live on `run.script.duration_sec` (≈620s). The clock
 * runs the compressed film (≈108s + verdict). Map a Run timestamp into
 * clock-seconds the SAME way the walkouts are scaled, so a card that seeks to a
 * drop lands exactly where that walkout happens on screen.
 */
export function runSecToClock(runSec, runDuration, clockDuration) {
  if (runSec == null) return null;
  if (!runDuration || !clockDuration) return runSec;
  return (runSec / runDuration) * clockDuration;
}
