import { useEffect, useMemo, useState } from 'react';
import presets from '../../data/presets.json';
import { usePersonaLibrary } from '../../data/usePersonaLibrary';
import './FrontDoor.css';

const categoryLabel = {
  all: 'All personas',
  attention: 'Attention',
  genre: 'Genre',
  language: 'Language',
  context: 'Context',
};

const presetLabel = (id) => id.replaceAll('_', ' ');

export function FrontDoor({ onStart }) {
  const { personas, source } = usePersonaLibrary();
  const defaultPreset = presets.find((preset) => preset.id === 'bharat_prime_time');
  const [selected, setSelected] = useState(defaultPreset?.personas ?? []);
  const [activePreset, setActivePreset] = useState('bharat_prime_time');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [script, setScript] = useState('');

  const byId = useMemo(() => new Map(personas.map((person) => [person.id, person])), [personas]);
  const seatable = (id) => byId.get(id)?.seeded === true;
  const unseeded = useMemo(() => personas.filter((person) => !person.seeded).length, [personas]);
  const categories = useMemo(
    () => ['all', ...new Set(personas.map((person) => person.category))],
    [personas],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return personas.filter((person) => (
      (category === 'all' || person.category === category)
      && (!needle || `${person.label} ${person.prompt} ${person.language}`.toLowerCase().includes(needle))
    ));
  }, [personas, category, query]);
  const selectedPeople = useMemo(
    () => selected.map((id) => byId.get(id)).filter((person) => person?.seeded),
    [selected, byId],
  );

  // When the live library arrives, remove bundled preset ids that the backend
  // cannot actually seat. Otherwise six invisible stale ids occupy all six
  // slots while the UI truthfully displays "0 / 6 selected".
  useEffect(() => {
    const selectable = new Set(
      personas.filter((person) => person.seeded).map((person) => person.id),
    );
    setSelected((current) => current.filter((id) => selectable.has(id)));
  }, [personas]);

  const choosePreset = (preset) => {
    setActivePreset(preset.id);
    // A preset written against the bundled library can name a persona the live
    // one has not seeded yet. Seat the ones that exist rather than handing
    // /analyse six ids and having it reject the lot.
    setSelected(preset.personas.filter(seatable));
    if (preset.id === 'custom') setCategory('all');
  };

  const toggle = (id) => {
    if (!seatable(id)) return;
    setActivePreset('custom');
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 6 ? [...current, id] : current);
  };

  const upload = (event) => {
    const file = event.target.files?.[0];
    if (file) file.text().then(setScript).catch(() => {});
  };

  return (
    <main className="front-door">
      <section className="front-door-panel">
        <div className="front-door-kicker">PEHLA SHOW</div>
        <h1>Bring in a script. Choose the room.</h1>
        <div className="front-door-top">
          <div>
            <label className="front-door-label" htmlFor="script-input">Episode script</label>
            <textarea id="script-input" value={script} onChange={(event) => setScript(event.target.value)} placeholder="Paste your script here" />
            <label className="script-upload">Or upload a .txt script<input type="file" accept=".txt,text/plain" onChange={upload} /></label>
          </div>
          <div className="preset-area">
            <div className="front-door-label">Start from a room preset</div>
            <div className="preset-chips">
              {presets.map((preset) => (
                <button type="button" key={preset.id} className={activePreset === preset.id ? 'is-active' : ''} onClick={() => choosePreset(preset)}>
                  {preset.id === 'custom' ? 'Custom' : presetLabel(preset.id)}
                </button>
              ))}
            </div>
            <p>Choose a preset, or build a custom room from the full persona library.</p>
          </div>
        </div>

        <div className="persona-heading">
          <div><div className="front-door-label">Persona library</div><p>{personas.length} viewer personas · select exactly six{source === 'bundled' ? ' · offline library' : unseeded > 0 ? ` · ${personas.length - unseeded} live` : ''}</p></div>
          <div className={`selection-count${selectedPeople.length === 6 ? ' is-complete' : ''}`}>{selectedPeople.length} / 6 selected · 5 seats each</div>
        </div>
        <div className="persona-workspace">
          <div className="persona-browser">
            <input className="persona-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search personas" aria-label="Search personas" />
            <div className="category-chips" aria-label="Persona categories">
              {categories.map((id) => (
                <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}>
                  {categoryLabel[id]}
                </button>
              ))}
            </div>
            <div className="persona-grid" aria-label="Persona library results">
              {filtered.map((person) => (
                <button type="button" key={person.id} className={`persona-card${selected.includes(person.id) ? ' is-selected' : ''}${person.seeded ? '' : ' is-unseeded'}`} onClick={() => toggle(person.id)} aria-pressed={selected.includes(person.id)} disabled={!person.seeded} title={person.seeded ? undefined : 'Not in the live library yet — cannot be screened'}>
                  <span>{person.label}</span>
                  <small>{person.prompt}</small>
                  <em>{person.seeded ? `${person.category} · ${person.language}` : 'not seeded yet'}</em>
                </button>
              ))}
            </div>
          </div>
          <aside className="selected-room">
            <div className="front-door-label">Your room</div>
            {selectedPeople.length === 0 && <p className="empty-room">Pick six personas to seat the room.</p>}
            <ol>
              {selectedPeople.map((person) => <li key={person.id}><span>{person.label}</span><button type="button" onClick={() => toggle(person.id)} aria-label={`Remove ${person.label}`}>Remove</button></li>)}
            </ol>
            <div className="spread-warning">Spread check: a mixed room makes the read more useful. This is a prompt, never a block.</div>
            {/* Guard on the resolved people, not the id list: the default
                preset is seated before the library loads, so an id the live
                library lacks would otherwise leave the button enabled on five. */}
            <button type="button" className="start-show" disabled={selectedPeople.length !== 6} onClick={() => onStart({ script, selected: selectedPeople.map((person) => person.id) })}>Open the doors</button>
          </aside>
        </div>
      </section>
    </main>
  );
}
