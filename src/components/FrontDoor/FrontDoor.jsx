import { useEffect, useMemo, useState } from 'react';
import presets from '../../data/presets.json';
import { Figure } from '../../audience/Figure';
import { usePersonaLibrary } from '../../data/usePersonaLibrary';
import hindiDemoScript from '../../../test-scripts/raat-ki-raseed-hindi.txt?raw';
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

// give each persona a stable little look, so the library reads as different people
const hairFor = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 4;
};

export function FrontDoor({ onStart }) {
  // Personas come from the live library (union of the bundled shelf + whatever
  // the backend has seeded). Only `seeded` personas can actually be cast.
  const { personas, source } = usePersonaLibrary();
  // The room starts empty — you cast it yourself (drag/click). No auto-selection.
  const [selected, setSelected] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [script, setScript] = useState('');
  const [dragging, setDragging] = useState(false);
  const [spotlight, setSpotlight] = useState({ x: -500, y: -500, visible: false, tone: 'warm' });
  const [scrollDepth, setScrollDepth] = useState(0);

  const byId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);
  const seatable = (id) => byId.get(id)?.seeded === true;

  const categories = useMemo(
    () => ['all', ...new Set(personas.map((p) => p.category))],
    [personas],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return personas.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!needle || `${p.label} ${p.prompt ?? ''} ${p.language ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [personas, category, query]);

  const add = (id) =>
    setSelected((cur) => (!seatable(id) || cur.includes(id) || cur.length >= 6 ? cur : [...cur, id]));
  const remove = (id) => setSelected((cur) => cur.filter((x) => x !== id));
  const markCustom = () => setActivePreset('custom');

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
    // Only seat personas the library actually has; a preset can name one the
    // backend hasn't seeded yet.
    setSelected(preset.personas.filter(seatable).slice(0, 6));
    if (preset.id === 'custom') setCategory('all');
  };

  // drag + click both work
  const dragStart = (e, id, from) => {
    setDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, from }));
  };
  const dragEnd = () => setDragging(false);
  const allow = (e) => e.preventDefault();
  const payload = (e) => {
    try {
      return JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      return null;
    }
  };
  const dropInRoom = (e) => {
    e.preventDefault();
    setDragging(false);
    const d = payload(e);
    if (d?.from === 'lib') {
      markCustom();
      add(d.id);
    }
  };
  const dropInLibrary = (e) => {
    e.preventDefault();
    setDragging(false);
    const d = payload(e);
    if (d?.from === 'room') {
      markCustom();
      remove(d.id);
    }
  };

  const slots = Array.from({ length: 6 }, (_, i) => selected[i] ?? null);
  const ready = selected.length === 6;
  const trackLight = (event) => setSpotlight((current) => ({ ...current, x: event.clientX - 260, y: event.clientY - 260, visible: true }));
  const setLightTone = (tone) => setSpotlight((current) => ({ ...current, tone }));
  const beamProgress = Math.min(scrollDepth / 900, 1);

  return (
    <main
      className="fd"
      onPointerMove={trackLight}
      onPointerLeave={() => setSpotlight((current) => ({ ...current, visible: false }))}
      onScroll={(event) => setScrollDepth(event.currentTarget.scrollTop)}
    >
      <div
        aria-hidden="true"
        className={`fd-spotlight fd-spotlight--${spotlight.tone}`}
        style={{ transform: `translate3d(${spotlight.x}px, ${spotlight.y}px, 0)`, opacity: spotlight.visible ? 1 : 0 }}
      />
      <div
        aria-hidden="true"
        className="fd-scroll-spotlight"
        style={{
          transform: `translate3d(-50%, ${Math.min(scrollDepth * 0.045, 68)}px, 0) scaleX(${(0.58 + beamProgress * 0.96).toFixed(3)})`,
          opacity: (0.26 + beamProgress * 0.35).toFixed(2),
        }}
      />
      <div className="fd-inner">
        <header className="fd-head">
          <div className="fd-edition"><span>PEHLA SHOW</span><span>SCREENING DRAFT · 01</span></div>
          <h1 className="fd-title">Meet your first audience.</h1>
          <p className="fd-sub">
            Paste an episode and cast who watches. We seat a room of real listener types and show
            you where the writing keeps them — and where it loses them — before the first show.
          </p>
          <div className="fd-reel" aria-hidden="true"><i /><i /><i /></div>
        </header>

        {/* 1 · THE SCRIPT — paste only, always .txt */}
        <section className="fd-step">
          <div className="fd-step-label"><span className="fd-num">1</span> The script</div>
          <div className="fd-script-desk">
            <div className="fd-script-meta">
              <span>EPISODE MATERIAL</span>
              <span className="fd-script-actions">
                <button type="button" onClick={() => setScript(hindiDemoScript)}>LOAD HINDI DEMO</button>
                <i>{script.trim() ? `${script.trim().split(/\s+/).length} WORDS` : 'AWAITING PAGES'}</i>
              </span>
            </div>
            <textarea
              className="fd-script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              onFocus={() => setLightTone('paper')}
              placeholder="Paste your episode here. Plain text — that's all it needs."
              spellCheck={false}
            />
          </div>
        </section>

        {/* 2 · CAST THE ROOM — drag from the library into your room (or click) */}
        <section className="fd-step">
          <div className="fd-step-head">
            <div className="fd-step-label"><span className="fd-num">2</span> Cast the room</div>
            <div className={`fd-count${ready ? ' is-ready' : ''}`}>{selected.length} of 6 · 5 seats each</div>
          </div>
          <p className="fd-hint">Drag a person into a seat — or just click. Click a seated person to send them home.</p>

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

          <div className="fd-cast">
            {/* LEFT — the library */}
            <div className="fd-library" onDragOver={allow} onDrop={dropInLibrary}>
              <div className="fd-library-heading"><span>Audience cards</span><small>{filtered.length} of {personas.length} profiles</small></div>
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
              <div className="fd-lib-list">
                {filtered.map((p) => {
                  const on = selected.includes(p.id);
                  const canSeat = p.seeded;
                  const full = !on && selected.length >= 6;
                  return (
                    <div
                      key={p.id}
                      className={`fd-lib-card${on ? ' is-on' : ''}${!canSeat ? ' is-locked' : full ? ' is-full' : ''}`}
                      data-category={p.category}
                      draggable={canSeat && !on && !full}
                      onDragStart={(e) => canSeat && dragStart(e, p.id, 'lib')}
                      onDragEnd={dragEnd}
                      onPointerEnter={() => setLightTone(p.category ?? 'warm')}
                      onClick={() => (!canSeat ? null : on ? remove(p.id) : full ? null : (markCustom(), add(p.id)))}
                      role="button"
                      aria-pressed={on}
                    >
                      <span className="fd-mini"><Figure hair={hairFor(p.id)} /></span>
                      <span className="fd-lib-body">
                        <span className="fd-lib-name">{p.label}</span>
                        <span className="fd-lib-meta">{p.prompt ?? `${p.category} · ${p.language}`}</span>
                      </span>
                      <span className="fd-lib-act">
                        {!canSeat ? 'coming soon' : on ? 'seated' : full ? 'room full' : 'drag / click'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {source === 'bundled' && (
                <div className="fd-lib-source">Showing the bundled library — the live backend isn't answering.</div>
              )}
            </div>

            {/* RIGHT — your room */}
            <div className="fd-room">
              <div className="fd-room-screen"><span>TONIGHT’S ROOM</span><small>FIVE SEATS EACH</small></div>
              <div className="fd-room-label">Cast of six</div>
              <div className="fd-seats" onDragOver={allow} onDrop={dropInRoom}>
                {slots.map((id, i) => {
                  const p = id ? byId.get(id) : null;
                  return (
                    <div
                      key={i}
                      className={`fd-seat${p ? ' is-filled' : ''}${!p && dragging ? ' is-drop' : ''}`}
                      onDragOver={allow}
                      onDrop={dropInRoom}
                      draggable={!!p}
                      onDragStart={(e) => p && dragStart(e, id, 'room')}
                      onDragEnd={dragEnd}
                      onClick={() => p && (markCustom(), remove(id))}
                      title={p ? `Remove ${p.label}` : 'Drop a persona here'}
                    >
                      {p ? (
                        <>
                          <span className="fd-mini"><Figure hair={hairFor(id)} /></span>
                          <span className="fd-seat-name">{p.label}</span>
                          <span className="fd-seat-x">remove</span>
                        </>
                      ) : (
                        <span className="fd-seat-empty">seat {i + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="fd-foot">
          <button type="button" className="fd-start" disabled={!ready} onClick={() => onStart({ script, selected })}>
            Open the doors
          </button>
          <span className="fd-foot-hint">
            {ready ? 'The room is ready.' : `Cast ${6 - selected.length} more to fill the room.`}
          </span>
        </div>
      </div>
    </main>
  );
}
