import { clock, useClock } from '../clock/useClock';
import { formatTime } from '../clock/format';
import './PlaybackBar.css';

const SPEEDS = [1, 2, 4];

/**
 * THE PLAYBACK BAR (B2 UI). Every control here writes to the one clock:
 * the scrubber sets time directly, the speed buttons change the multiplier,
 * play/pause drives the shared animation loop. It holds no time of its own.
 */
export function PlaybackBar() {
  const { currentSeconds, isPlaying, speed, duration } = useClock();

  return (
    <div className="playback-bar">
      <button
        className="pb-btn"
        onClick={() => clock.rewind()}
        aria-label="Rewind to start"
        title="Rewind to start"
      >
        &#9668;&#9668;
      </button>

      <button
        className="pb-btn pb-play"
        onClick={() => clock.toggle()}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <input
        className="pb-scrubber"
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={currentSeconds}
        onChange={(e) => clock.seek(Number(e.target.value))}
        aria-label="Scrubber"
      />

      <span className="pb-time">
        {formatTime(currentSeconds)} / {formatTime(duration)}
      </span>

      <div className="pb-speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`pb-btn pb-speed${speed === s ? ' is-active' : ''}`}
            onClick={() => clock.setSpeed(s)}
            aria-pressed={speed === s}
          >
            {s}&times;
          </button>
        ))}
      </div>
    </div>
  );
}
