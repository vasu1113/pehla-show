import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilmStrip } from './film/FilmStrip';
import { AudienceLayer } from './audience/AudienceLayer';
import { CriticBoxes } from './critics/CriticsBalcony';
import { buildTimeline, filmChunksForRun, VERDICT_SECONDS } from './film/filmData';
import { PlaybackBar } from './components/PlaybackBar';
import { clock, useClock } from './clock/useClock';
import { FrontDoor } from './components/FrontDoor/FrontDoor';
import { EntryTheatre } from './components/EntryTheatre/EntryTheatre';
import { PostScreen } from './components/PostScreen/PostScreen';
import { useRun } from './data/useRun';
import './App.css';

const ENTRY_SECONDS = 18;

export default function App() {
  const [phase, setPhase] = useState('intro');
  const [audienceKey, setAudienceKey] = useState(0);
  const { currentSeconds, duration, isPlaying } = useClock();
  const { run, status, progress, error, startAnalysis } = useRun();
  const chunks = useMemo(() => filmChunksForRun(run), [run]);
  const { total } = useMemo(() => buildTimeline(chunks), [chunks]);

  const enterTheatre = useCallback((request) => {
    clock.pause();
    clock.setDuration(ENTRY_SECONDS);
    clock.rewind();
    setPhase('entry');
    clock.play();
    startAnalysis(request).catch(() => {});
  }, [startAnalysis]);

  const startFilm = useCallback(() => {
    clock.pause();
    clock.setDuration(total + VERDICT_SECONDS);
    clock.rewind();
    setPhase('screening');
    setAudienceKey((key) => key + 1);
    clock.play();
  }, [total]);

  useEffect(() => {
    if (
      phase === 'entry'
      && status === 'ready'
      && !isPlaying
      && currentSeconds >= duration
    ) startFilm();
    if (phase === 'screening' && !isPlaying && currentSeconds >= duration) setPhase('review');
  }, [currentSeconds, duration, isPlaying, phase, startFilm, status]);

  if (phase === 'intro') return <FrontDoor onStart={enterTheatre} />;
  if (phase === 'entry') {
    return <EntryTheatre analysisStatus={status} progress={progress} error={error} />;
  }
  if (phase === 'review') return <PostScreen />;
  return (
    <main className="screening-view">
      <div className="screening-film"><FilmStrip /></div>
      <div className="screening-house">
        <CriticBoxes side="left" silent />
        <AudienceLayer key={audienceKey} entered />
        <CriticBoxes side="right" silent />
      </div>
      {phase === 'screening' && currentSeconds >= 4 && <PlaybackBar />}
    </main>
  );
}
