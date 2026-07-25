/**
 * THE CLOCK (B2) — the single source of truth for time in the whole app.
 *
 * The architectural rule: the theatre, the film, the script pane, the curve
 * and the playback bar all read `currentSeconds` from here and draw themselves
 * from it. NO component keeps its own timer. Ever.
 *
 * This module owns the ONE requestAnimationFrame loop in the app. Play advances
 * time by real elapsed time * speed, so dragging the scrubber backwards rewinds
 * everything instantly with no reload, and speed changes never cause a jump.
 */

// Default duration until real script data is wired in (10:20 from the mock UI).
const DEFAULT_DURATION = 620;

/** @type {{ currentSeconds: number, isPlaying: boolean, speed: 1|2|4, duration: number }} */
let state = {
  currentSeconds: 0,
  isPlaying: false,
  speed: 1,
  duration: DEFAULT_DURATION,
};

const listeners = new Set();

// The one animation-loop handle for the entire app.
let rafId = null;
// Timestamp of the previous frame, used to compute real elapsed time.
let lastFrameTs = null;

function emit() {
  for (const listener of listeners) listener();
}

/** Replace state with a new object (so snapshot identity changes) and notify. */
function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

function tick(ts) {
  if (!state.isPlaying) {
    rafId = null;
    lastFrameTs = null;
    return;
  }

  // First frame after (re)starting: establish a baseline, advance nothing.
  if (lastFrameTs === null) {
    lastFrameTs = ts;
    rafId = requestAnimationFrame(tick);
    return;
  }

  const deltaSeconds = ((ts - lastFrameTs) / 1000) * state.speed;
  lastFrameTs = ts;

  const next = state.currentSeconds + deltaSeconds;

  if (next >= state.duration) {
    // Stop cleanly at the end.
    state = { ...state, currentSeconds: state.duration, isPlaying: false };
    rafId = null;
    lastFrameTs = null;
    emit();
    return;
  }

  state = { ...state, currentSeconds: next };
  emit();
  rafId = requestAnimationFrame(tick);
}

function ensureLoop() {
  if (rafId === null) {
    lastFrameTs = null;
    rafId = requestAnimationFrame(tick);
  }
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastFrameTs = null;
}

export const clockStore = {
  getState() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  play() {
    if (state.isPlaying) return;
    // Restart from the top if we're parked at the end.
    const atEnd = state.currentSeconds >= state.duration;
    setState({ isPlaying: true, currentSeconds: atEnd ? 0 : state.currentSeconds });
    ensureLoop();
  },

  pause() {
    if (!state.isPlaying) return;
    stopLoop();
    setState({ isPlaying: false });
  },

  toggle() {
    if (state.isPlaying) this.pause();
    else this.play();
  },

  /** Set the clock directly. Works forwards or backwards, playing or paused. */
  seek(seconds) {
    const clamped = Math.max(0, Math.min(state.duration, seconds));
    // Recalibrate the frame baseline so the next tick doesn't apply a stale delta.
    lastFrameTs = null;
    setState({ currentSeconds: clamped });
  },

  setSpeed(speed) {
    setState({ speed });
  },

  rewind() {
    this.seek(0);
  },

  /** Wire in the real script length once data arrives (Track C). */
  setDuration(duration) {
    const clampedCurrent = Math.min(state.currentSeconds, duration);
    setState({ duration, currentSeconds: clampedCurrent });
  },
};
