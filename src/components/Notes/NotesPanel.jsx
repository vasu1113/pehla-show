import { useRun } from '../../data/useRun';
import './NotesPanel.css';

/** Format raw run-timeline seconds as m:ss (e.g. 220 → "3:40"). */
function formatRunSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Retention % from seats — one decimal place, never whole-number rounded. */
function retentionPct(seatsRetained, seatsTotal) {
  if (!seatsTotal) return '0.0%';
  return `${((seatsRetained / seatsTotal) * 100).toFixed(1)}%`;
}

/** Worst-first copy of top_losses (highest seats_lost first). */
function sortedLosses(topLosses) {
  return [...(topLosses || [])].sort((a, b) => b.seats_lost - a.seats_lost);
}

/**
 * Plain-text dump of the whole notes panel, built from summary fields only
 * (never scraped from the DOM).
 */
export function buildNotesText(summary) {
  const {
    seats_retained,
    seats_total,
    top_losses,
    consensus_line,
    recommended_fix,
    predicted_seats_saved,
  } = summary;

  const pct = retentionPct(seats_retained, seats_total);
  const lines = [
    `${seats_retained} of ${seats_total} stayed.`,
    pct,
    '',
    'WHERE YOU LOST THEM',
    ...sortedLosses(top_losses).map(
      (l) =>
        `${formatRunSec(l.timestamp)} — lost ${l.seats_lost} — ${l.reason_label}`,
    ),
    '',
    'WHAT THE ROOM AGREED ON',
    consensus_line,
    '',
    'THE ONE CHANGE',
    recommended_fix,
    `+${predicted_seats_saved} seats`,
  ];
  return lines.join('\n');
}

/**
 * THE NOTES — the stakeholder-facing summary: how many stayed, where seats
 * left, what the room agreed, and the one recommended fix.
 */
export function NotesPanel({ onApplyFix }) {
  const { run, status } = useRun();

  if (status !== 'ready' || !run) return null;

  const summary = run.summary;
  if (!summary) return null;

  const {
    seats_retained,
    seats_total,
    top_losses,
    consensus_line,
    recommended_fix,
    predicted_seats_saved,
  } = summary;

  const pct = retentionPct(seats_retained, seats_total);
  const losses = sortedLosses(top_losses);
  const canApply = typeof onApplyFix === 'function';

  const handleCopy = () => {
    try {
      const text = buildNotesText(summary);
      const p = navigator.clipboard?.writeText(text);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* Clipboard API unavailable — ignore */
    }
  };

  return (
    <div className="notes-panel">
      <div className="notes-head">
        <span className="notes-head-label">THE NOTES</span>
        <button type="button" className="notes-btn notes-btn--copy" onClick={handleCopy}>
          Copy
        </button>
      </div>

      <div className="notes-scroll">
        {/* 1. THE NUMBER */}
        <div className="notes-tile notes-tile--hero">
          <div className="notes-hero-val">
            {seats_retained} of {seats_total} stayed.
          </div>
          <div className="notes-hero-pct">{pct}</div>
        </div>

        {/* 2. WHERE YOU LOST THEM */}
        <section className="notes-block">
          <div className="notes-label">WHERE YOU LOST THEM</div>
          <ul className="notes-losses">
            {losses.map((l, i) => (
              <li key={`${l.timestamp}-${l.reason_label}-${i}`} className="notes-loss">
                <span className="notes-loss-time">{formatRunSec(l.timestamp)}</span>
                <span className="notes-loss-sep"> — lost </span>
                <span className="notes-loss-count">{l.seats_lost}</span>
                <span className="notes-loss-sep"> — </span>
                <span className="notes-loss-reason">{l.reason_label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. WHAT THE ROOM AGREED ON */}
        <section className="notes-block">
          <div className="notes-label">WHAT THE ROOM AGREED ON</div>
          <p className="notes-body">{consensus_line}</p>
        </section>

        {/* 4. THE ONE CHANGE */}
        <section className="notes-block">
          <div className="notes-label">THE ONE CHANGE</div>
          <p className="notes-body">{recommended_fix}</p>
          <div className="notes-fix-row">
            <span className="notes-seats-saved">+{predicted_seats_saved} seats</span>
            <button
              type="button"
              className="notes-btn notes-btn--apply"
              disabled={!canApply}
              onClick={() => {
                if (canApply) onApplyFix();
              }}
            >
              Apply and re-run
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
