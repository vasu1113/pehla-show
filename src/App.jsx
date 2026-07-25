import { useEffect, useRef, useState } from 'react';
import Theatre from './Theatre';

// THE ONLY CLOCK.
//
// currentTime lives here and nowhere else. Theatre is a pure function
// of it. Playback advances it via requestAnimationFrame; scrubbing sets
// it directly and everything re-derives from scratch — including seats
// refilling when you scrub backwards.

const SPEEDS = [1, 2, 4];

export default function App() {
  const [run, setRun] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [highlightSeat, setHighlightSeat] = useState(null);
  const [showIndex, setShowIndex] = useState(false);

  // Track A builds against the mock until the API is live; swapping to
  // GET /runs/{id} is a one-line change here and nowhere else.
  useEffect(() => {
    fetch('/data/mockRun.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(setRun)
      .catch(() => setLoadError('no mockRun.json yet — showing an empty hall'));
  }, []);

  const duration = run?.script?.duration_sec ?? 600;
  const audience = run?.audience ?? [];

  const raf = useRef(0);
  const last = useRef(0);
  useEffect(() => {
    if (!isPlaying) return;
    last.current = performance.now();

    const tick = (now) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setCurrentTime((t) => {
        const next = t + dt * speed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [isPlaying, speed, duration]);

  const seated = audience.filter(
    (m) => m.left_at_sec == null || m.left_at_sec > currentTime
  ).length;

  const selected =
    highlightSeat == null
      ? null
      : audience.find((m) => m.seat === highlightSeat) ?? null;

  return (
    <div className="stage">
      <div className="stage-inner">
        <Theatre
          showIndex={showIndex}
          audience={audience}
          currentTime={currentTime}
          onSeatClick={(s) => setHighlightSeat((cur) => (cur === s ? null : s))}
          highlightSeat={highlightSeat}
        />

        <div className="transport">
          <button className="ghost" onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? 'pause' : 'play'}
          </button>

          <input
            className="scrub"
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTime(Number(e.target.value));
            }}
          />

          <span className="readout">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <button
            className="ghost"
            onClick={() =>
              setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])
            }
          >
            {speed}&times;
          </button>
        </div>

        <div className="caption">
          <span>
            {audience.length
              ? `${seated} of ${audience.length} still seated`
              : loadError ?? 'loading'}
          </span>
          <button className="ghost" onClick={() => setShowIndex((v) => !v)}>
            {showIndex ? 'hide' : 'show'} seat numbers
          </button>
        </div>

        {selected && (
          <div className="tooltip">
            <div className="tooltip-name">{selected.name}</div>
            <div className="tooltip-meta">
              seat {selected.seat} &middot; {selected.cohort}
            </div>
            {selected.left_at_sec == null ? (
              <p className="tooltip-body">Stayed to the end.</p>
            ) : (
              <>
                <p className="tooltip-body">
                  Left at {fmt(selected.left_at_sec)} &mdash;{' '}
                  {selected.reason_label ?? selected.reason_code}
                </p>
                {selected.evidence && (
                  <p className="tooltip-evidence">
                    &ldquo;{selected.evidence}&rdquo;
                  </p>
                )}
              </>
            )}
            <button className="ghost" onClick={() => setHighlightSeat(null)}>
              close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
