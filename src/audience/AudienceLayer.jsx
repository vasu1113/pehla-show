import { memo, useMemo } from 'react';
import { buildThoughtSchedule, activeThoughts } from './thoughtData';
import { buildVerdictBubbles, activeVerdictBubbles, popcornProgress } from './verdictData';
import { Figure } from './Figure';
import { useRunAudience } from './useRunAudience';
import { useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import { stateFor, ease } from '../figures';
import { useHighlight } from '../highlight/highlightStore';
import './AudienceLayer.css';

/**
 * NX1 (Track B) + the walkout (Track A) + the verdict (B6).
 *
 * Track B seats them and animates arrivals; Track A decides who leaves, when
 * and why (an exit on its own wrapper so it never fights the `arrive`
 * keyframes). At the end, whoever is still HERE takes a verdict pose — the
 * people who left are already gone, so their empty seat is their review.
 *
 * Pure function of the clock: scrub to the end and the hall reacts; scrub back
 * and everyone walks in again.
 */
const Figures = memo(function Figures({ people, currentSeconds, total, entered, highlight }) {
  const inVerdict = currentSeconds >= total;
  return (
    <>
      {people.map((p) => {
        const { state, t } = stateFor(p.id, p.leftAtSec, currentSeconds);
        if (state === 'gone') return null;

        // Analytics ↔ seats: lit when its cohort or its seat is highlighted.
        const lit =
          highlight &&
          ((highlight.cohort && (p.cohort === highlight.cohort || p.type === highlight.cohort)) ||
            (highlight.seats && (highlight.seats.includes(p.id) || highlight.seats.includes(p.seat))));

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

        // B6 verdict pose — only for people still in their seat at the end.
        // (Someone who left has no verdict; their absence is the review.)
        const tier = p.verdict === 'left' ? 'stands' : p.verdict;
        const poseClass = inVerdict && state === 'here' ? ` verdict verdict--${tier}` : '';

        return (
          <div
            key={p.id}
            className={`seat-slot${entered ? ' is-seated' : ''}${poseClass}${lit ? ' is-highlit' : ''}`}
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
            {/* exit transform + fade kept off .seat-slot so the arrive
                keyframes (left/top/opacity) stay untouched */}
            <div className="exit-wrap" style={{ transform: exit, opacity }}>
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

  const active = activeThoughts(schedule, currentSeconds).slice(0, 1);
  if (active.length === 0) return null;

  return (
    <>
      {active.map(({ event, opacity }) => {
        const preferred = people[event.personId];
        const p = stateFor(preferred.id, preferred.leftAtSec, currentSeconds).state === 'here'
          ? preferred
          : people.find((candidate) => stateFor(candidate.id, candidate.leftAtSec, currentSeconds).state === 'here');
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

/** B6 — the staggered verdict bubbles (max six), from the people who STAYED. */
function VerdictBubbles({ people, total }) {
  const { currentSeconds } = useClock();
  const stayers = useMemo(
    () => people.filter((p) => p.leftAtSec == null || p.leftAtSec >= total),
    [people, total],
  );
  const schedule = useMemo(() => buildVerdictBubbles(stayers), [stayers]);
  const vt = currentSeconds - total;
  if (vt < 0) return null;

  const active = activeVerdictBubbles(schedule, vt).slice(0, 1);
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

/** B6 — the popcorn throw, from the fed-up people who stayed to throw it. */
function Popcorn({ people, timed, total, currentSeconds }) {
  const extreme = timed.find(
    (chunk) => chunk.tension >= 0.9 && currentSeconds >= chunk.start && currentSeconds <= chunk.start + 1.2,
  );
  const prog = extreme
    ? (currentSeconds - extreme.start) / 1.2
    : popcornProgress(currentSeconds - timed[timed.length - 1].end);
  if (prog === null) return null;

  const throwers = people.filter(
    (p) => p.verdict === 'popcorn' && (p.leftAtSec == null || p.leftAtSec >= total),
  );
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
 * THE AUDIENCE LAYER — walkout during the film, verdict at the end.
 */
export function AudienceLayer({ entered = false }) {
  const { currentSeconds, duration } = useClock();
  const { people } = useRunAudience(duration);
  const { timed, total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const inVerdict = currentSeconds >= total;
  const highlight = useHighlight();
  const hasHighlight = Boolean(highlight.cohort || highlight.seats);

  const seated = people.filter(
    (p) => stateFor(p.id, p.leftAtSec, currentSeconds).state === 'here',
  ).length;

  return (
    <div className="audience">
      <div className={`audience-floor${hasHighlight ? ' has-highlight' : ''}`}>
        <Figures people={people} currentSeconds={currentSeconds} total={total} entered={entered} highlight={highlight} />
        {!inVerdict && <LiveThoughts people={people} currentSeconds={currentSeconds} />}
        {inVerdict && <VerdictBubbles people={people} total={total} />}
        <Popcorn people={people} timed={timed} total={total} currentSeconds={currentSeconds} />
      </div>

      <div className="seated-count">
        {seated} of {people.length} still here
      </div>
    </div>
  );
}
