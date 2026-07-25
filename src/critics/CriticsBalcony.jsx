import { useMemo } from 'react';
import { CRITICS, buildCriticSchedule, activeCriticNotes } from './criticsData';
import { useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import './CriticsBalcony.css';

/**
 * A critic — a dark silhouette in the balcony, distinct from the audience.
 * They sit still and watch; only their note bubble reacts.
 */
function CriticFigure() {
  return (
    <svg className="critic-svg" viewBox="0 0 36 44" width="36" height="44">
      {/* silhouette: near-black, no stroke, faint rim light off the screen */}
      <path
        className="critic-body"
        d="M4 44 C3 30 9 24 18 24 C27 24 33 30 32 44 Z"
      />
      <ellipse className="critic-head" cx="18" cy="16" rx="8" ry="8.5" />
      <path className="critic-rim" d="M11 17 C10.5 11 12.5 8 15 7 C12.5 10 12 13.5 12.5 17 Z" />
    </svg>
  );
}

/**
 * THE BALCONY — "the room that explains". Five critics with distinct lenses,
 * dropping analytical notes DURING the film (the live A/B against the crowd).
 * Reads THE CLOCK; notes are pure functions of it, so scrubbing is exact.
 * Full reviews come in the end verdict (B6), next.
 */
export function CriticsBalcony() {
  const { currentSeconds } = useClock();
  const schedule = useMemo(() => {
    const { timed } = buildTimeline(FILM_CHUNKS);
    return buildCriticSchedule(timed);
  }, []);

  const active = activeCriticNotes(schedule, currentSeconds);
  const noteByCritic = new Map(active.map((a) => [a.event.criticId, a]));

  return (
    <div className="balcony">
      <div className="balcony-label">THE BALCONY · the room that explains</div>
      <div className="balcony-rail">
        {CRITICS.map((cr) => {
          const note = noteByCritic.get(cr.id);
          return (
            <div key={cr.id} className="critic" style={{ left: `${cr.x}%` }}>
              {note && (
                <div className="critic-note" style={{ opacity: note.opacity }}>
                  <span className="cn-who">{cr.name} · {cr.lens}</span>
                  <span className="cn-text">{note.event.text}</span>
                </div>
              )}
              <CriticFigure />
              <span className="critic-tag">{cr.lens}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
