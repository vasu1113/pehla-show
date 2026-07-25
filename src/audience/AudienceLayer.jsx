import { memo, useMemo } from 'react';
import { generateAudience } from './audienceData';
import { buildThoughtSchedule, activeThoughts } from './thoughtData';
import { buildVerdictBubbles, activeVerdictBubbles, popcornProgress } from './verdictData';
import { Figure } from './Figure';
import { useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import './AudienceLayer.css';

/**
 * NX1 — the seated figures + one-shot entrance/expectation. During the verdict
 * (B6) each seat takes its verdict pose via a CSS class. Memoized on (people,
 * verdict), so it renders once for the film and once when the verdict begins.
 */
const Figures = memo(function Figures({ people, verdict }) {
  return (
    <>
      {people.map((p) => {
        const poseClass = verdict ? ` verdict verdict--${p.verdict}` : '';
        return (
          <div
            key={p.id}
            className={`seat-slot${poseClass}`}
            style={{
              left: `${p.fl}%`,
              top: `${p.ft}%`,
              transform: `translate(-50%, -50%) scale(${p.scale})`,
              zIndex: Math.round(p.ft),
              '--fl': `${p.fl}%`,
              '--ft': `${p.ft}%`,
              '--sl': `${p.sl}%`,
              '--st': `${p.st}%`,
              '--d': `${p.delay}s`,
            }}
          >
            {p.showsBubble && !verdict && (
              <div className="expectation-bubble" style={{ '--bd': `${p.bubbleDelay}s` }}>
                {p.expectation}
              </div>
            )}
            <div className="fig-wrap" style={{ '--d': `${p.delay}s` }}>
              <Figure tone={p.tone} hair={p.hair} />
            </div>
          </div>
        );
      })}
    </>
  );
});

/**
 * NX2 — live thoughts during the film (clock-driven, sparse). Not shown during
 * the verdict.
 */
function LiveThoughts({ people }) {
  const { currentSeconds } = useClock();
  const schedule = useMemo(() => {
    const { timed } = buildTimeline(FILM_CHUNKS);
    return buildThoughtSchedule(timed, people.length);
  }, [people.length]);

  const active = activeThoughts(schedule, currentSeconds);
  if (active.length === 0) return null;

  return (
    <>
      {active.map(({ event, opacity }) => {
        const p = people[event.personId];
        if (!p) return null;
        return (
          <div
            key={event.id}
            className="thought-slot"
            style={{
              left: `${p.fl}%`,
              top: `${p.ft}%`,
              transform: `translate(-50%, -50%) scale(${p.scale})`,
              zIndex: 200,
            }}
          >
            <div className="thought-bubble" style={{ opacity }}>
              {event.text}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** B6 — the staggered verdict bubbles (max six on screen), clock-driven. */
function VerdictBubbles({ people, total }) {
  const { currentSeconds } = useClock();
  const schedule = useMemo(() => buildVerdictBubbles(people), [people]);
  const vt = currentSeconds - total;
  if (vt < 0) return null;

  const active = activeVerdictBubbles(schedule, vt);
  return (
    <>
      {active.map((b) => {
        const p = people[b.personId];
        if (!p) return null;
        return (
          <div
            key={b.personId}
            className="verdict-slot"
            style={{
              left: `${p.fl}%`,
              top: `${p.ft}%`,
              transform: `translate(-50%, -50%) scale(${p.scale})`,
              zIndex: 250,
            }}
          >
            <div className={`verdict-bubble verdict-bubble--${p.verdict}`} style={{ opacity: b.opacity }}>
              {b.text}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** B6 — the popcorn throw: an arc of kernels toward the screen, clock-driven. */
function Popcorn({ people, total }) {
  const { currentSeconds } = useClock();
  const prog = popcornProgress(currentSeconds - total);
  if (prog === null) return null;

  const throwers = people.filter((p) => p.verdict === 'popcorn');
  return (
    <>
      {throwers.map((p) => (
        <div key={p.id} className="popcorn-arc" style={{ left: `${p.fl}%`, top: `${p.ft}%` }}>
          {[0, 1, 2, 3, 4].map((k) => {
            const t = Math.max(0, Math.min(1, prog * 1.25 - k * 0.12));
            const y = -t * 150; // fly up toward the screen
            const x = (k - 2) * 7 * t;
            return (
              <span
                key={k}
                className="kernel"
                style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: t > 0 ? 1 - t : 0 }}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

/**
 * THE AUDIENCE LAYER. Remount (via a changing `key` from the parent) replays
 * the arrivals.
 */
export function AudienceLayer() {
  const people = useMemo(() => generateAudience(), []);
  const { currentSeconds } = useClock();
  const { total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const inVerdict = currentSeconds >= total;

  return (
    <div className="audience">
      <div className="audience-floor">
        <Figures people={people} verdict={inVerdict} />
        {!inVerdict && <LiveThoughts people={people} />}
        {inVerdict && <VerdictBubbles people={people} total={total} />}
        {inVerdict && <Popcorn people={people} total={total} />}
      </div>
    </div>
  );
}
