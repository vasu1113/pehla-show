import { useEffect, useMemo } from 'react';
import { clock, useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline, chunkAtTime, VERDICT_SECONDS } from './filmData';
import './FilmStrip.css';

// Cross-fade length when the clock crosses into a new chunk.
const FADE_SECONDS = 0.8;

/**
 * One still on the screen. Shows a generated image when the chunk has one,
 * otherwise the filmic fallback card. The screen is NEVER blank.
 */
function Still({ chunk, transform }) {
  if (!chunk) {
    return (
      <div className="still still--card" style={{ transform }}>
        <div className="still-type">NO FILM</div>
      </div>
    );
  }
  if (chunk.imageUrl) {
    return (
      <div className="still" style={{ transform }}>
        <img className="still-img" src={chunk.imageUrl} alt="" draggable={false} />
      </div>
    );
  }
  return (
    <div className="still still--card" style={{ transform }} data-type={chunk.type}>
      <div className="still-type">{chunk.type}</div>
      <div className="still-line">{chunk.line}</div>
    </div>
  );
}

/** Slow zoom + drift for a still, derived from its progress (0..1). */
function kenBurns(index, progress) {
  const scale = 1.02 + 0.04 * progress; // ~4% zoom over the chunk
  const dir = index % 2 === 0 ? 1 : -1; // alternate drift so it doesn't feel uniform
  const x = dir * 1.6 * progress; // percent
  const y = -1.2 * progress;
  return `scale(${scale.toFixed(4)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
}

/**
 * THE FILM STRIP (B5). A sequence of stills that reads as a silent film,
 * driven entirely by THE CLOCK. Scrubbing backwards rewinds it correctly
 * because every visual below is a function of `currentSeconds`.
 */
export function FilmStrip() {
  const { currentSeconds } = useClock();

  const { timed, total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);

  // Clock runs the film's length PLUS the verdict tail (B6).
  useEffect(() => {
    if (total > 0) clock.setDuration(total + VERDICT_SECONDS);
  }, [total]);

  // Once the film ends, the screen fades to dark and holds for the verdict.
  if (timed.length > 0 && currentSeconds >= total) {
    return (
      <div className="film-screen film-screen--ended">
        <div className="film-grain" />
        <div className="film-vignette" />
      </div>
    );
  }

  if (timed.length === 0) {
    return (
      <div className="film-screen">
        <Still chunk={null} transform="scale(1.02)" />
        <div className="film-grain" />
        <div className="film-vignette" />
        <div className="film-flicker" />
      </div>
    );
  }

  // Which chunk are we in? (Shared helper so every reader agrees.)
  const { index, chunk } = chunkAtTime(timed, currentSeconds);
  const t = Math.min(currentSeconds, total - 0.0001);
  const timeIntoChunk = t - chunk.start;
  const progress = Math.max(0, Math.min(1, timeIntoChunk / chunk.duration));

  // Cross-fade: the previous still lingers on top, fading out over FADE_SECONDS.
  const inFade = index > 0 && timeIntoChunk < FADE_SECONDS;
  const prev = inFade ? timed[index - 1] : null;
  const prevOpacity = inFade ? 1 - timeIntoChunk / FADE_SECONDS : 0;

  // High-tension chunks glow brighter; quiet ones dim.
  const brightness = (0.8 + 0.35 * chunk.tension).toFixed(3);

  return (
    <div className="film-screen" style={{ filter: `brightness(${brightness})`, opacity: Math.min(1, currentSeconds / 0.8) }}>
      <Still chunk={chunk} transform={kenBurns(index, progress)} />

      {prev && (
        <div className="still-layer" style={{ opacity: prevOpacity }}>
          <Still chunk={prev} transform={kenBurns(index - 1, 1)} />
        </div>
      )}

      <div className="film-grain" />
      <div className="film-vignette" />
      <div className="film-flicker" />
    </div>
  );
}
