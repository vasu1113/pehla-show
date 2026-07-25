import { memo, useMemo } from 'react';
import { generateAudience } from './audienceData';
import { buildThoughtSchedule, activeThoughts } from './thoughtData';
import { Figure } from './Figure';
import { useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import './AudienceLayer.css';

/**
 * NX1 — the seated figures + one-shot entrance/expectation. Memoized and clock-
 * free, so it renders once and does not churn while the film plays.
 */
const Figures = memo(function Figures({ people }) {
  return (
    <>
      {people.map((p) => (
        <div
          key={p.id}
          className="seat-slot"
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
          {p.showsBubble && (
            <div className="expectation-bubble" style={{ '--bd': `${p.bubbleDelay}s` }}>
              {p.expectation}
            </div>
          )}
          {/* wrapper carries the walk-bob during the entrance */}
          <div className="fig-wrap" style={{ '--d': `${p.delay}s` }}>
            <Figure tone={p.tone} skin={p.skin} hair={p.hair} cloth={p.cloth} />
          </div>
        </div>
      ))}
    </>
  );
});

/**
 * NX2 — live thoughts during the film. Reads THE CLOCK and renders only the
 * thoughts whose time-window contains the current moment, positioned over the
 * reacting person's seat. Pure function of the clock → scrubbing shows exactly
 * the right thoughts, no timers.
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

/**
 * THE AUDIENCE LAYER. Remount (via a changing `key` from the parent) replays
 * the arrivals.
 */
export function AudienceLayer() {
  const people = useMemo(() => generateAudience(), []);

  return (
    <div className="audience">
      <div className="audience-floor">
        <Figures people={people} />
        <LiveThoughts people={people} />
      </div>
    </div>
  );
}
