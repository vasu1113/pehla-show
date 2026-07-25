import { useMemo } from 'react';
import { useClock } from '../../clock/useClock';
import { generateAudience } from '../../audience/audienceData';
import { Figure } from '../../audience/Figure';
import { CriticBoxes } from '../../critics/CriticsBalcony';
import './EntryTheatre.css';

const ENTER_DURATION = 1.1;
const chatter = [
  { start: 3.4, end: 5.8, person: 2 },
  { start: 6.4, end: 8.8, person: 9 },
  { start: 9.4, end: 11.8, person: 17 },
  { start: 12.1, end: 14.2, person: 23 },
];

const clamp = (value) => Math.max(0, Math.min(1, value));

export function EntryTheatre() {
  const { currentSeconds } = useClock();
  const people = useMemo(() => generateAudience(), []);
  const door = clamp(currentSeconds / 2.2);
  const remark = chatter.find((item) => currentSeconds >= item.start && currentSeconds < item.end);
  const bridge = currentSeconds >= 12;
  const bridgeLine = currentSeconds < 14.2 ? 'THE ROOM SETTLES' : currentSeconds < 16.4 ? 'HOUSE LIGHTS DIM' : 'FIRST FRAME IN 3 · 2 · 1';

  return (
    <main className="entry-theatre">
      <div className={`entry-screen${bridge ? ' is-bridging' : ''}`}>
        <span>{bridge ? bridgeLine : 'THE SCREEN IS WAITING'}</span>
        {bridge && <small>projection begins when the room is ready</small>}
      </div>
      <div className="entry-doors" aria-hidden="true">
        <span style={{ transform: `translateX(${-50 * door}%)` }} />
        <span style={{ transform: `translateX(${50 * door}%)` }} />
      </div>
      <div className="entry-floor">
        {people.map((person) => {
          const progress = clamp((currentSeconds - (2.4 + person.id * 0.23)) / ENTER_DURATION);
          const ease = 1 - Math.pow(1 - progress, 2.2);
          return (
            <div
              className="entry-person"
              key={person.id}
              style={{
                left: `${person.fl}%`, top: `${person.ft}%`, zIndex: Math.round(person.ft),
                opacity: ease,
                transform: `translate(-50%, ${((1 - ease) * 95 - 50).toFixed(1)}%) scale(${person.scale})`,
              }}
            >
              <Figure tone={person.tone} hair={person.hair} />
            </div>
          );
        })}
        {remark && <div className="entry-remark">{people[remark.person].expectation}</div>}
      </div>
      <div className="entry-critic entry-critic--left"><CriticBoxes side="left" silent /></div>
      <div className="entry-critic entry-critic--right"><CriticBoxes side="right" silent /></div>
    </main>
  );
}
