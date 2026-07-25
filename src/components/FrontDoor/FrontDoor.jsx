import { useMemo, useState } from 'react';
import personas from '../../data/personas.json';
import presets from '../../data/presets.json';
import './FrontDoor.css';

const categoryLabel = {
  all: 'All',
  attention: 'Attention',
  genre: 'Genre',
  language: 'Language',
  context: 'Context',
};

const titleCase = (s) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const presetLabel = (id) => (id === 'custom' ? 'Custom room' : titleCase(id));
const personaById = new Map(personas.map((p) => [p.id, p]));

export function FrontDoor({ onStart }) {
  const defaultPreset = presets.find((p) => p.id === 'bharat_prime_time');
  const [selected, setSelected] = useState(defaultPreset?.personas ?? []);
  const [activePreset, setActivePreset] = useState('bharat_prime_time');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [script, setScript] = useState('');

  const categories = useMemo(() => ['all', ...new Set(personas.map((p) => p.category))], []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return personas.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!needle || `${p.label} ${p.context} ${p.language}`.toLowerCase().includes(needle)),
    );
  }, [category, query]);

  const choosePreset = (preset) => {
    setActivePreset(preset.id);
    setSelected(preset.personas);
    if (preset.id === 'custom') setCategory('all');
  };

  const toggle = (id) => {
    setActivePreset('custom');
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 6 ? [...cur, id] : cur,
    );
  };

  const slots = Array.from({ length: 6 }, (_, i) => selected[i] ?? null);
  const ready = selected.length === 6;

  return (
    <main className="fd">
      <div className="fd-inner">
        <header className="fd-head">
          <div className="fd-kicker">PEHLA SHOW</div>
          <h1 className="fd-title">Meet your first audience.</h1>
          <p className="fd-sub">
            Paste an episode and choose who watches. We seat a room of real listener types and
            show you where the writing keeps them — and where it loses them — before the first show.
          </p>
        </header>

        {/* 1 · THE SCRIPT — paste only, always .txt */}
        <section className="fd-step">
          <div className="fd-step-label"><span className="fd-num">1</span> The script</div>
          <textarea
            className="fd-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your episode here. Plain text — that's all it needs."
            spellCheck={false}
          />
        </section>

        {/* 2 · THE AUDIENCE — six seats that fill as you pick */}
        <section className="fd-step">
          <div className="fd-step-head">
            <div className="fd-step-label"><span className="fd-num">2</span> The audience</div>
            <div className={`fd-count${ready ? ' is-ready' : ''}`}>{selected.length} of 6 · 5 seats each</div>
          </div>

          <div className="fd-slots" aria-label="Your chosen room">
            {slots.map((id, i) => {
              const p = id ? personaById.get(id) : null;
              return (
                <button
                  type="button"
                  key={i}
                  className={`fd-slot${p ? ' is-filled' : ''}`}
                  onClick={() => p && toggle(id)}
                  title={p ? `Remove ${p.label}` : 'Empty seat'}
                  disabled={!p}
                >
                  {p ? (
                    <>
                      <span className="fd-slot-name">{p.label}</span>
                      <span className="fd-slot-hint">remove</span>
                    </>
                  ) : (
                    <span className="fd-slot-empty">seat {i + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="fd-quick">
            <span className="fd-quick-label">Start from a room</span>
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`fd-chip${activePreset === preset.id ? ' is-active' : ''}`}
                onClick={() => choosePreset(preset)}
              >
                {presetLabel(preset.id)}
              </button>
            ))}
          </div>

          <div className="fd-browse">
            <input
              className="fd-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search personas"
              aria-label="Search personas"
            />
            <div className="fd-cats" aria-label="Categories">
              {categories.map((id) => (
                <button
                  type="button"
                  key={id}
                  className={`fd-cat${category === id ? ' is-active' : ''}`}
                  onClick={() => setCategory(id)}
                >
                  {categoryLabel[id] ?? titleCase(id)}
                </button>
              ))}
            </div>
          </div>

          <div className="fd-grid" aria-label="Persona library">
            {filtered.map((p) => {
              const on = selected.includes(p.id);
              const full = !on && selected.length >= 6;
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`fd-card${on ? ' is-on' : ''}`}
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  disabled={full}
                >
                  <span className="fd-card-name">{p.label}</span>
                  <span className="fd-card-ctx">{p.context}</span>
                  <span className="fd-card-meta">
                    {p.is_calibrated ? `calibrated · ${p.calibrated_from} real walkouts` : 'variant'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="fd-foot">
          <button type="button" className="fd-start" disabled={!ready} onClick={() => onStart({ script, selected })}>
            Open the doors
          </button>
          <span className="fd-foot-hint">
            {ready ? 'The room is ready.' : `Pick ${6 - selected.length} more to seat the room.`}
          </span>
        </div>
      </div>
    </main>
  );
}
