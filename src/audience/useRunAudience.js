import { useEffect, useMemo, useState } from 'react';
import { generateAudience } from './audienceData';

/**
 * Marries Track B's seating to Track A's screening.
 *
 * Track B's generateAudience() owns where a person sits, how they arrive, and
 * what they mutter on the way in. Track A's run object owns who they actually
 * are and when — and why — they walk out. Neither half is the whole audience;
 * this joins them on seat index.
 *
 * Until the run loads (or if it never does) the layer still renders Track B's
 * thirty arrivals, so the screen is never empty while we wait on the API.
 */

/** Track A's mock is 608s; Track B's film strip is 108s. Exits are placed at
 *  the same FRACTION of the show so both halves stay in step whatever the two
 *  durations are. When Track C ships film chunks cut from the real script the
 *  ratio becomes 1 and this quietly stops doing anything. */
function scaleToClock(seconds, runDuration, clockDuration) {
  if (seconds == null) return null;
  if (!runDuration || !clockDuration) return seconds;
  return (seconds / runDuration) * clockDuration;
}

export function useRunAudience(clockDuration) {
  const seats = useMemo(() => generateAudience(), []);
  const [run, setRun] = useState(null);

  useEffect(() => {
    let live = true;
    fetch('/data/mockRun.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => live && setRun(d))
      .catch(() => {
        /* no run yet — Track B's arrivals still play, nobody leaves */
      });
    return () => {
      live = false;
    };
  }, []);

  const people = useMemo(() => {
    const bySeat = new Map((run?.audience ?? []).map((m) => [m.seat, m]));
    const runDuration = run?.script?.duration_sec;

    return seats.map((seat) => {
      const member = bySeat.get(seat.id);
      if (!member) return seat;
      return {
        ...seat,
        // The contract's cohort id wins over Track B's placeholder type.
        type: member.cohort,
        name: member.name,
        leftAtSec: scaleToClock(member.left_at_sec, runDuration, clockDuration),
        leftAtRealSec: member.left_at_sec,
        leftAtBeat: member.left_at_beat,
        reasonCode: member.reason_code,
        reasonLabel: member.reason_label,
        evidence: member.evidence,
      };
    });
  }, [seats, run, clockDuration]);

  return { people, run };
}
