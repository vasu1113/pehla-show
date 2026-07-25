export { useRun } from './RunContext';

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
