import { useEffect, useMemo, useRef } from 'react';
import { clock, useClock } from '../clock/useClock';
import { formatTime } from '../clock/format';
import { FILM_CHUNKS, buildTimeline, chunkAtTime } from '../film/filmData';
import './ScriptPane.css';

/**
 * B3 THE SCRIPT PANE. The script as continuous readable text on the left.
 * The chunk currently playing is highlighted; the pane scrolls itself as
 * playback advances; clicking any chunk jumps the clock there.
 *
 * Reads THE CLOCK — no timer of its own. Uses the same chunk timeline as the
 * film, so the highlight and the screen can never disagree.
 */
export function ScriptPane() {
  const { currentSeconds } = useClock();
  const { timed } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const { index } = chunkAtTime(timed, currentSeconds);

  const scrollRef = useRef(null);
  const blockRefs = useRef([]);

  // Keep the active chunk comfortably in view. Fires only on chunk change
  // (not every frame), so the scroll is a smooth step, not a jitter.
  useEffect(() => {
    const container = scrollRef.current;
    const el = blockRefs.current[index];
    if (!container || !el) return;
    const target = el.offsetTop - container.clientHeight * 0.32;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [index]);

  return (
    <div className="script-pane">
      <div className="script-head">THE SCRIPT</div>
      <div className="script-scroll" ref={scrollRef}>
        {timed.map((c, i) => (
          <div
            key={c.id}
            ref={(el) => (blockRefs.current[i] = el)}
            className={`script-chunk${i === index ? ' is-active' : ''}`}
            onClick={() => clock.seek(c.start)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clock.seek(c.start);
              }
            }}
          >
            <div className="sc-label">
              <span className="sc-type">{c.type}</span>
              <span className="sc-time">{formatTime(c.start)}</span>
            </div>
            <p className="sc-text">{c.script}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
