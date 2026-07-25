import { memo, useMemo, useState } from 'react';
import { buildThoughtSchedule, activeThoughts } from './thoughtData';
import { Figure } from './Figure';
import { useRunAudience } from './useRunAudience';
import { useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import { stateFor, ease } from '../figures';
import './AudienceLayer.css';

/**
 * NX1 + the walkout.
 *
 * Track B seats them and animates the arrivals; Track A decides who leaves,
 * when, and why. The exit lives on its own wrapper so it never fights the
 * `arrive` keyframes, which own left/top/opacity on .seat-slot.
 *
 * Pure function of the clock: no timers, no memory. Scrub to the end and the
 * hall is empty; scrub back and everyone is seated again — which is the whole
 * reason this component is allowed to exist.
 */
const Figures = memo(function Figures({ people, currentSeconds, onPick }) {
  return (
    <>
      {people.map((p) => {
        const { state, t } = stateFor(p.id, p.leftAtSec, currentSeconds);
        if (state === 'gone') return null;

        // Stand, shuffle to the aisle, then away — mirrors Track A's exit.
        let exit = '';
        let opacity = 1;
        if (state === 'leaving') {
          const e = ease(t);
          const dir = p.col < 3 ? -1 : 1;
          const dx = dir * 90 * e;
          const dy = -10 * Math.min(1, t * 3) + 60 * Math.max(0, e - 0.35) * 1.4;
          exit = `translate(${dx}px, ${dy}px)`;
          opacity = 1 - Math.max(0, (t - 0.45) / 0.55);
        }

        return (
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
            {p.showsBubble && state === 'here' && (
              <div className="expectation-bubble" style={{ '--bd': `${p.bubbleDelay}s` }}>
                {p.expectation}
              </div>
            )}
            {/* exit transform + fade — kept off .seat-slot so the arrive
                keyframes (left/top/opacity) stay untouched */}
            <div
              className="exit-wrap"
              style={{ transform: exit, opacity }}
              onClick={() => p.reasonLabel && onPick(p)}
              role={p.reasonLabel ? 'button' : undefined}
            >
              <div className="fig-wrap" style={{ '--d': `${p.delay}s` }}>
                <Figure tone={p.tone} hair={p.hair} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
});

/**
 * NX2 — live thoughts during the film. Only from people still in the room:
 * a seat that emptied ninety seconds ago has no opinion about this chunk.
 */
function LiveThoughts({ people, currentSeconds }) {
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
        if (stateFor(p.id, p.leftAtSec, currentSeconds).state !== 'here') return null;
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

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function AudienceLayer() {
  const { currentSeconds, duration } = useClock();
  const { people } = useRunAudience(duration);
  const [picked, setPicked] = useState(null);

  const seated = people.filter(
    (p) => stateFor(p.id, p.leftAtSec, currentSeconds).state === 'here'
  ).length;

  return (
    <div className="audience">
      <div className="audience-floor">
        <Figures people={people} currentSeconds={currentSeconds} onPick={setPicked} />
        <LiveThoughts people={people} currentSeconds={currentSeconds} />
      </div>

      <div className="seated-count">
        {seated} of {people.length} still here
      </div>

      {picked && (
        <div className="who-card">
          <div className="who-name">{picked.name}</div>
          <div className="who-meta">
            seat {picked.id} &middot; {picked.type}
          </div>
          <p className="who-body">
            Left at {fmt(picked.leftAtRealSec)} &mdash; {picked.reasonLabel}
          </p>
          {picked.evidence && <p className="who-evidence">&ldquo;{picked.evidence}&rdquo;</p>}
          <button className="ghost-btn" onClick={() => setPicked(null)}>
            close
          </button>
        </div>
      )}
    </div>
  );
}
