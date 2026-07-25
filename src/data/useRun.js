import { useEffect, useState } from 'react';

/**
 * The one Run loader. Every panel reads the same Run from here (mock mode
 * fetches the seeded file; later this swaps for the live API). Cached at module
 * level so thirty consumers cause one fetch.
 */
let cache = null;
let inflight = null;

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
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
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
