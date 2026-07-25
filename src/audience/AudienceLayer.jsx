import { memo, useMemo } from 'react';
import { buildThoughtSchedule, activeThoughts } from './thoughtData';
import { buildVerdictBubbles, activeVerdictBubbles, popcornProgress } from './verdictData';
import { Figure } from './Figure';
import { useRunAudience } from './useRunAudience';
import { useClock } from '../clock/useClock';
import { buildTimeline, filmChunksForRun } from '../film/filmData';
import { useRun } from '../data/useRun';
import { stateFor, ease } from '../figures';
import { useHighlight } from '../highlight/highlightStore';
import { buildCriticSchedule, activeCriticNotes } from '../critics/criticsData';
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
function LiveThoughts({ people, currentSeconds, chunks, reactions }) {
  const schedule = useMemo(() => {
    const { timed } = buildTimeline(chunks);
    return buildThoughtSchedule(timed, reactions);
  }, [chunks, reactions]);

  const active = activeThoughts(schedule, currentSeconds).slice(0, 1);
  if (active.length === 0) return null;

  return (
    <>
      {active.map(({ event, opacity }) => {
        const p = people.find(
          (candidate) => candidate.type === event.cohort
            && stateFor(candidate.id, candidate.leftAtSec, currentSeconds).state === 'here',
        );
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
function VerdictBubbles({ people, total, reactions }) {
  const { currentSeconds } = useClock();
  const stayers = useMemo(
    () => people.filter((p) => p.leftAtSec == null || p.leftAtSec >= total),
    [people, total],
  );
  const schedule = useMemo(() => buildVerdictBubbles(stayers, reactions), [stayers, reactions]);
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

/** A rare shared-peak reaction: three people, one line, a few kernels in beam. */
function Popcorn({ people, timed, total, currentSeconds }) {
  const extreme = timed.find(
    (chunk) => chunk.tension >= 0.9 && currentSeconds >= chunk.start + 0.45 && currentSeconds <= chunk.start + 2.15,
  );
  const peakIndex = extreme ? timed.indexOf(extreme) : -1;
  const prog = extreme
    ? (currentSeconds - extreme.start - 0.45) / 1.7
    : popcornProgress(currentSeconds - timed[timed.length - 1].end);
  if (prog === null) return null;

  const eligible = people.filter((p) => p.leftAtSec == null || p.leftAtSec >= currentSeconds);
  const throwers = extreme
    ? eligible.filter((p) => (p.id + peakIndex * 3) % 4 === 0).slice(0, 3)
    : eligible.filter((p) => p.verdict === 'popcorn' && (p.leftAtSec == null || p.leftAtSec >= total));
  return (
    <>
      {throwers.map((p) => (
        <div key={p.id} className="popcorn-arc" style={{ left: `${p.fl}%`, top: `${p.ft}%` }}>
          {extreme && <span className="popcorn-seat-glow" style={{ opacity: Math.min(1, prog * 2, (1 - prog) * 2.8) }} />}
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

/** One angry walkout gets a physical beat before disappearing into the aisle. */
function AngryWalkoutPopcorn({ people, currentSeconds }) {
  const angry = people.find((person) => {
    const { state } = stateFor(person.id, person.leftAtSec, currentSeconds);
    return state === 'leaving' && /PACING|STAKES|HOOK|QUESTION/.test(person.reasonCode ?? '');
  });
  if (!angry) return null;
  const { t } = stateFor(angry.id, angry.leftAtSec, currentSeconds);
  // The cup leaves their hand early in the exit, travelling into the aisle —
  // never through the middle of the seated audience.
  const progress = Math.max(0, Math.min(1, t / 0.52));
  const direction = angry.col < 3 ? -1 : 1;
  const arc = Math.sin(progress * Math.PI) * 30;
  const x = direction * (18 + progress * 74);
  const y = -arc + progress * 16;

  return (
    <div className="popcorn-toss" style={{ left: `${angry.fl}%`, top: `${angry.ft}%` }}>
      <span
        className="popcorn-cup"
        style={{
          transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(direction * (12 + progress * 82)).toFixed(1)}deg)`,
          opacity: 1 - Math.max(0, (progress - 0.72) / 0.28),
        }}
      />
    </div>
  );
}

/**
 * THE AUDIENCE LAYER — walkout during the film, verdict at the end.
 */
export function AudienceLayer({ entered = false }) {
  const { currentSeconds, duration } = useClock();
  const { run } = useRun();
  const { people } = useRunAudience(duration);
  const chunks = useMemo(() => filmChunksForRun(run), [run]);
  const { timed, total } = useMemo(() => buildTimeline(chunks), [chunks]);
  const criticSchedule = useMemo(
    () => buildCriticSchedule(timed, run?.notes ?? []),
    [timed, run?.notes],
  );
  const inVerdict = currentSeconds >= total;
  const peakReaction = timed.some((chunk) => chunk.tension >= 0.9 && currentSeconds >= chunk.start + 0.45 && currentSeconds <= chunk.start + 2.15);
  const criticSpeaking = activeCriticNotes(criticSchedule, currentSeconds).length > 0;
  const highlight = useHighlight();
  const hasHighlight = Boolean(highlight.cohort || highlight.seats);

  const seated = people.filter(
    (p) => stateFor(p.id, p.leftAtSec, currentSeconds).state === 'here',
  ).length;

  return (
    <div className="audience">
      <div className={`audience-floor${hasHighlight ? ' has-highlight' : ''}`}>
        <Figures people={people} currentSeconds={currentSeconds} total={total} entered={entered} highlight={highlight} />
        {!inVerdict && !peakReaction && !criticSpeaking && (
          <LiveThoughts
            people={people}
            currentSeconds={currentSeconds}
            chunks={chunks}
            reactions={run?.audience_reactions ?? []}
          />
        )}
        {inVerdict && <VerdictBubbles people={people} total={total} reactions={run?.audience_reactions ?? []} />}
        {!criticSpeaking && <Popcorn people={people} timed={timed} total={total} currentSeconds={currentSeconds} />}
        <AngryWalkoutPopcorn people={people} currentSeconds={currentSeconds} />
      </div>

      <div className="seated-count">
        {seated} of {people.length} still here
      </div>
    </div>
  );
}
