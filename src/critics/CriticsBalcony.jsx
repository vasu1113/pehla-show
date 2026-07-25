import { useMemo } from 'react';
import { CRITICS, buildCriticSchedule, activeCriticNotes } from './criticsData';
import { useClock } from '../clock/useClock';
import { buildTimeline, filmChunksForRun } from '../film/filmData';
import { useRun } from '../data/useRun';
import './CriticsBalcony.css';

/**
 * A critic — a dark silhouette seated in an opera box, distinct from the crowd.
 * They sit still and watch; only their note reacts.
 */
function CriticFigure() {
  return (
    <svg className="critic-svg" viewBox="0 0 36 40" width="34" height="38">
      <path className="critic-body" d="M4 40 C3 27 9 22 18 22 C27 22 33 27 32 40 Z" />
      <ellipse className="critic-head" cx="18" cy="14" rx="7.5" ry="8" />
      <path className="critic-rim" d="M11 15 C10.5 10 12.5 7 15 6 C12.5 9 12 12 12.5 15 Z" />
    </svg>
  );
}

/**
 * One wall of critic boxes in the opera-house horseshoe (left or right).
 * Boxes climb the wall (row 0 at the top). Critics drop analytical notes DURING
 * the film — the live A/B against the crowd — opening inward toward the stalls.
 * Reads THE CLOCK; notes are pure functions of it, so scrubbing is exact.
 */
export function CriticBoxes({ side, silent = false }) {
  const { currentSeconds } = useClock();
  const { run } = useRun();
  const chunks = useMemo(() => filmChunksForRun(run), [run]);
  const schedule = useMemo(() => {
    const { timed } = buildTimeline(chunks);
    return buildCriticSchedule(timed);
  }, [chunks]);

  const active = silent ? [] : activeCriticNotes(schedule, currentSeconds);
  const noteByCritic = new Map(active.map((a) => [a.event.criticId, a]));

  const critics = CRITICS.filter((c) => c.side === side).sort((a, b) => a.row - b.row);

  return (
    <div className={`critic-col critic-col--${side}`}>
      {critics.map((cr) => {
        const note = noteByCritic.get(cr.id);
        return (
          <div key={cr.id} className="opera-box">
            <div className="box-interior">
              <CriticFigure />
              <div className="box-rail" />
            </div>
            <span className="box-tag">{cr.name} · {cr.lens}</span>

            {note && (
              <div
                className={`critic-note critic-note--${side}`}
                style={{ opacity: note.opacity }}
              >
                <span className="cn-who">{cr.name} · {cr.lens}</span>
                <span className="cn-text">{note.event.text}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
