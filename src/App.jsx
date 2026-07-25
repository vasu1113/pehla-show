import { useState, useMemo } from 'react';
import { FilmStrip } from './film/FilmStrip';
import { ScriptPane } from './components/ScriptPane';
import { AnalysisPanel } from './analysis/AnalysisPanel';
import { CastingPanel } from './analysis/CastingPanel';
import { EvidencePanel } from './components/Evidence/EvidencePanel';
import { NotesPanel } from './components/Notes/NotesPanel';
import { AudienceLayer } from './audience/AudienceLayer';
import { CriticBoxes } from './critics/CriticsBalcony';
import { FILM_CHUNKS, buildTimeline, chunkAtTime } from './film/filmData';
import { PlaybackBar } from './components/PlaybackBar';
import { useClock } from './clock/useClock';
import { formatTime } from './clock/format';
import './App.css';

export default function App() {
  // Bumping this remounts the audience layer, replaying the arrivals.
  const [arrivalKey, setArrivalKey] = useState(0);
  // Left column shows the script or the analysis backbone.
  const [leftTab, setLeftTab] = useState('script');
  const { currentSeconds, duration, speed, isPlaying } = useClock();

  const { timed } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const { index, chunk } = chunkAtTime(timed, currentSeconds);

  return (
    <div className="show">
      <header className="show-header">
        <span className="sh-title">PEHLA SHOW</span>
        <span className="sh-sub">the screen · track b</span>
      </header>

      <div className="show-body">
        {/* Left column — script (B3) or the analysis backbone, toggled. */}
        <div className="left-col">
          <div className="left-tabs">
            <button
              className={`left-tab${leftTab === 'script' ? ' is-active' : ''}`}
              onClick={() => setLeftTab('script')}
            >
              SCRIPT
            </button>
            <button
              className={`left-tab${leftTab === 'casting' ? ' is-active' : ''}`}
              onClick={() => setLeftTab('casting')}
            >
              CASTING
            </button>
            <button
              className={`left-tab${leftTab === 'analysis' ? ' is-active' : ''}`}
              onClick={() => setLeftTab('analysis')}
            >
              ANALYSIS
            </button>
            <button
              className={`left-tab${leftTab === 'evidence' ? ' is-active' : ''}`}
              onClick={() => setLeftTab('evidence')}
            >
              EVIDENCE
            </button>
            <button
              className={`left-tab${leftTab === 'notes' ? ' is-active' : ''}`}
              onClick={() => setLeftTab('notes')}
            >
              NOTES
            </button>
          </div>
          {leftTab === 'script' && <ScriptPane />}
          {leftTab === 'casting' && <CastingPanel />}
          {leftTab === 'analysis' && <AnalysisPanel />}
          {leftTab === 'evidence' && <EvidencePanel />}
          {leftTab === 'notes' && <NotesPanel />}
        </div>

        {/* Right column — the cinema: screen (B5) on top, audience below. */}
        <div className="show-right">
          <div className="screen-wrap">
            <FilmStrip />
          </div>

          {/* The house — an opera-house horseshoe: the clueless crowd in the
              centre stalls, critics in boxes climbing the side walls (the live
              A/B). NX1/NX2 audience is a Track-B prototype; Track A's Theatre.jsx
              stays untouched (reconcile at B8). */}
          <div className="house">
            <CriticBoxes side="left" />
            <AudienceLayer key={arrivalKey} />
            <CriticBoxes side="right" />
          </div>

          <div className="caption">
            <span>the screen + 30 listeners</span>
            <button className="ghost-btn" onClick={() => setArrivalKey((k) => k + 1)}>
              replay arrivals
            </button>
          </div>
        </div>
      </div>

      {/* An independent reader of THE CLOCK, reading the SAME timeline the
          screen and script do — a live cross-check that nothing drifts. */}
      <div className="clock-readout">
        <span className="cr-item">CLOCK <b>{currentSeconds.toFixed(2)}s</b></span>
        <span className="cr-item">{formatTime(currentSeconds)} / {formatTime(duration)}</span>
        <span className="cr-item">
          CHUNK <b>{chunk ? `${String(index + 1).padStart(2, '0')} · ${chunk.type}` : '—'}</b>
        </span>
        <span className="cr-item">{isPlaying ? 'PLAYING' : 'PAUSED'} · {speed}&times;</span>
      </div>

      <PlaybackBar />
    </div>
  );
}
