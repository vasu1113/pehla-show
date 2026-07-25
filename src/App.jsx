import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilmStrip } from './film/FilmStrip';
import { AudienceLayer } from './audience/AudienceLayer';
import { CriticBoxes } from './critics/CriticsBalcony';
import { FILM_CHUNKS, buildTimeline, VERDICT_SECONDS } from './film/filmData';
import { PlaybackBar } from './components/PlaybackBar';
import { clock, useClock } from './clock/useClock';
import { FrontDoor } from './components/FrontDoor/FrontDoor';
import { EntryTheatre } from './components/EntryTheatre/EntryTheatre';
import { PostScreen } from './components/PostScreen/PostScreen';
import personaData from './data/personas.json';
import { simulateRun } from './data/simulateRun';
import { setActiveRun } from './data/useRun';
import './App.css';

const ENTRY_SECONDS = 18;
const personaById = new Map(personaData.map((p) => [p.id, p]));

export default function App() {
  const [phase, setPhase] = useState('intro');
  const [audienceKey, setAudienceKey] = useState(0);
  const { currentSeconds, duration, isPlaying } = useClock();
  const { total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);

  const enterTheatre = useCallback((payload) => {
    // Cast → analytics: build the run from the six chosen personas before the
    // screening mounts, so the whole room + analytics reflect who's watching.
    const ids = payload?.selected ?? [];
    if (ids.length === 6) {
      const chosen = ids.map((id) => personaById.get(id)).filter(Boolean);
      if (chosen.length === 6) setActiveRun(simulateRun(chosen));
    }
    clock.pause();
    clock.setDuration(ENTRY_SECONDS);
    clock.rewind();
    setPhase('entry');
    clock.play();
  }, []);

  const startFilm = useCallback(() => {
    clock.pause();
    clock.setDuration(total + VERDICT_SECONDS);
    clock.rewind();
    setPhase('screening');
    setAudienceKey((key) => key + 1);
    clock.play();
  }, [total]);

  useEffect(() => {
    if (phase === 'entry' && !isPlaying && currentSeconds >= duration) startFilm();
    if (phase === 'screening' && !isPlaying && currentSeconds >= duration) setPhase('review');
  }, [currentSeconds, duration, isPlaying, phase, startFilm]);

  if (phase === 'intro') return <FrontDoor onStart={enterTheatre} />;
  if (phase === 'entry') return <EntryTheatre />;
  if (phase === 'review') return <PostScreen />;
  return (
    <main className="screening-view">
      <div className="screening-film"><FilmStrip /></div>
      <div className="screening-house">
        <CriticBoxes side="left" />
        <AudienceLayer key={audienceKey} entered />
        <CriticBoxes side="right" />
      </div>
      {phase === 'screening' && currentSeconds >= 4 && <PlaybackBar />}
    </main>
  );
}
