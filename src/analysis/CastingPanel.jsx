import { useState } from 'react';
import './CastingPanel.css';

/**
 * CASTING — the operator picks WHO watches the film and WHAT the analysis is
 * shaped on. This is a UI PLACEHOLDER: the persona roster and the re-run will
 * come from the backend (Track A / Track C). The drag-and-drop and controls are
 * wired to local state only for now, so the surface is ready to connect.
 */

// Placeholder personas — real roster arrives from the backend.
const INITIAL_SCREENING = [
  { id: 'commuter', name: 'COMMUTER', count: 8 },
  { id: 'night', name: 'NIGHT RIDER', count: 5 },
  { id: 'sleep', name: 'SLEEP LISTENER', count: 5 },
  { id: 'devotee', name: 'DEVOTEE', count: 4 },
  { id: 'surfer', name: 'CHANNEL SURFER', count: 4 },
  { id: 'family', name: 'FAMILY', count: 4 },
];
const INITIAL_ROSTER = [
  { id: 'genz', name: 'GEN-Z BINGER', count: 0 },
  { id: 'nri', name: 'NRI DIASPORA', count: 0 },
  { id: 'tier2', name: 'TIER-2 FIRST-RUN', count: 0 },
  { id: 'critic-pool', name: 'STRINGER CRITIC', count: 0 },
];

const WEIGHT_OPTIONS = ['RETENTION', 'ENGAGEMENT', 'VERDICT'];
const SEGMENT_OPTIONS = ['TYPE', 'AGE', 'REGION'];

function Chip({ persona, zone, onDragStart }) {
  return (
    <div
      className="cast-chip"
      draggable
      onDragStart={(e) => onDragStart(e, persona.id, zone)}
      title="Drag to move"
    >
      <span className="cast-grip">⠿</span>
      <span className="cast-chip-name">{persona.name}</span>
      {persona.count > 0 && <span className="cast-chip-count">×{persona.count}</span>}
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="cast-seg-row">
      <span className="cast-seg-label">{label}</span>
      <div className="cast-seg">
        {options.map((o) => (
          <button
            key={o}
            className={`cast-seg-btn${value === o ? ' is-active' : ''}`}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CastingPanel() {
  const [screening, setScreening] = useState(INITIAL_SCREENING);
  const [roster, setRoster] = useState(INITIAL_ROSTER);
  const [weight, setWeight] = useState('RETENTION');
  const [segment, setSegment] = useState('TYPE');

  const onDragStart = (e, id, from) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, from }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, to) => {
    e.preventDefault();
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    const { id, from } = payload;
    if (from === to) return;
    const src = from === 'screening' ? screening : roster;
    const setSrc = from === 'screening' ? setScreening : setRoster;
    const setDst = to === 'screening' ? setScreening : setRoster;
    const persona = src.find((p) => p.id === id);
    if (!persona) return;
    setSrc((list) => list.filter((p) => p.id !== id));
    setDst((list) => [...list, persona]);
  };

  const allow = (e) => e.preventDefault();

  return (
    <div className="casting-panel">
      <div className="cast-head">CASTING · WHO WATCHES</div>
      <div className="cast-scroll">
        <p className="cast-note">
          Placeholder — the persona roster and re-run are driven by the backend
          (Track A / Track C). Drag to move between the roster and the screening.
        </p>

        <div className="cast-zone-label">SCREENING TO · {screening.length} personas</div>
        <div className="cast-zone cast-zone--screening" onDragOver={allow} onDrop={(e) => onDrop(e, 'screening')}>
          {screening.length === 0 && <div className="cast-empty">drag personas here</div>}
          {screening.map((p) => (
            <Chip key={p.id} persona={p} zone="screening" onDragStart={onDragStart} />
          ))}
        </div>

        <div className="cast-zone-label">ROSTER · available (from backend)</div>
        <div className="cast-zone cast-zone--roster" onDragOver={allow} onDrop={(e) => onDrop(e, 'roster')}>
          {roster.length === 0 && <div className="cast-empty">everyone is in the screening</div>}
          {roster.map((p) => (
            <Chip key={p.id} persona={p} zone="roster" onDragStart={onDragStart} />
          ))}
        </div>

        <div className="cast-zone-label">ANALYSIS BASIS</div>
        <Segmented label="WEIGHT BY" options={WEIGHT_OPTIONS} value={weight} onChange={setWeight} />
        <Segmented label="SEGMENT BY" options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} />

        <button className="cast-rerun" disabled title="Backend (Track A/C) — coming soon">
          RE-RUN ON BACKEND →
        </button>
      </div>
    </div>
  );
}
