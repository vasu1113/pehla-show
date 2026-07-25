import { useMemo } from 'react';
import { clock, useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import { runSecToClock, useRun } from '../data/useRun';
import './AnalysisPanel.css';

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pct0 = (v) => `${Math.round(v * 100)}%`;

// Build a step-after path (retention is a step function: it only drops).
function stepPath(points, x, y) {
  let d = `M ${x(points[0].t)} ${y(points[0].value)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${x(points[i].t)} ${y(points[i - 1].value)} L ${x(points[i].t)} ${y(points[i].value)}`;
  }
  return d;
}

/** AN.1 — the retention curve: % still listening over time, walkout dots, a
 *  live current-time marker, click a dot to jump the clock. Monochrome. */
function RetentionChart({ run, total, onSeek }) {
  const { currentSeconds } = useClock();
  const W = 980, H = 360, padL = 58, padR = 24, padT = 20, padB = 48;
  const x = (t) => padL + (t / total) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (H - padT - padB);

  const { path, dots } = useMemo(() => {
    if (!run?.summary) return { path: '', dots: [] };
    const runDuration = run.script?.duration_sec;
    let remaining = run.summary.seats_total;
    const evs = (run.drop_events ?? []).map((drop) => {
      remaining -= drop.seats_lost.length;
      const time = runSecToClock(drop.timestamp, runDuration, total);
      return {
        chunkIndex: drop.id,
        chunkType: drop.reason_label,
        count: drop.seats_lost.length,
        time,
        value: remaining / run.summary.seats_total,
      };
    });
    const pts = [
      { t: 0, value: 1 },
      ...evs.map((event) => ({ t: event.time, value: event.value })),
      { t: total, value: run.summary.seats_retained / run.summary.seats_total },
    ];
    return {
      path: stepPath(pts, x, y),
      dots: evs.map((event) => ({ ...event, cx: x(event.time), cy: y(event.value) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, total]);

  const mx = x(Math.max(0, Math.min(total, currentSeconds)));

  return (
    <div className="an-block">
      <div className="an-label">RETENTION · % STILL LISTENING</div>
      <svg className="an-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Retention over time">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line className="an-grid" x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} />
            <text className="an-tick" x={padL - 5} y={y(v) + 3} textAnchor="end">{pct0(v)}</text>
          </g>
        ))}
        {[0, total / 2, total].map((t) => (
          <text key={t} className="an-tick" x={x(t)} y={H - 16} textAnchor="middle">
            {formatRunTime(t)}
          </text>
        ))}
        {/* current-time marker */}
        <line className="an-marker" x1={mx} y1={padT} x2={mx} y2={H - padB} />
        {/* the retention step line */}
        <path className="an-line" d={path} />
        {/* walkout cliffs — the one place red is allowed */}
        {dots.map((d) => (
          <circle
            key={d.chunkIndex}
            className="an-dot"
            cx={d.cx}
            cy={d.cy}
            r="4"
            onClick={() => onSeek(d.time)}
          >
            <title>{`${d.chunkType}: ${d.count} left`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/** AN.6 — per-segment small multiples: one quiet sparkline per listener type. */
function CohortRetention({ cohorts = [] }) {
  return (
    <div className="an-block">
      <div className="an-label">WHO STAYED WITH IT</div>
      <div className="an-multiples">
        {cohorts.map((cohort) => (
          <div className="an-mult" key={cohort.id}>
            <div className="an-mult-head">
              <span className="an-mult-type">{cohort.label}</span>
              <span className="an-mult-val">{pct(cohort.retained_pct)}</span>
            </div>
            <div className="an-bar" aria-label={`${cohort.label}: ${pct(cohort.retained_pct)} retained`}>
              <span style={{ width: `${cohort.retained_pct * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** AN.5 — the scorecard a stakeholder acts on. */
function Scorecard({ run }) {
  const summary = run.summary;
  const cohorts = run.cohorts ?? [];
  const biggest = [...(run.drop_events ?? [])].sort((a, b) => b.seats_lost.length - a.seats_lost.length)[0];
  const best = [...cohorts].sort((a, b) => b.retained_pct - a.retained_pct)[0];
  const worst = [...cohorts].sort((a, b) => a.retained_pct - b.retained_pct)[0];
  const verdict = summary.retained_pct >= 0.66 ? 'WORKS' : summary.retained_pct >= 0.45 ? 'MIXED' : 'LOSES THE ROOM';
  return (
    <div className="an-scorecard">
      <div className="an-tile an-tile--hero">
        <div className="an-tile-val">{pct(summary.seats_retained / summary.seats_total)}</div>
        <div className="an-tile-cap">STAYED TO THE END · {summary.seats_retained}/{summary.seats_total}</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{verdict}</div>
        <div className="an-tile-cap">PREDICTED VERDICT</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">
          {biggest ? `${biggest.seats_lost.length} @ ${formatRunTime(biggest.timestamp)}` : '—'}
        </div>
        <div className="an-tile-cap">BIGGEST DROP-OFF</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{best ? `${best.label} ${pct(best.retained_pct)}` : '—'}</div>
        <div className="an-tile-cap">BEST SEGMENT</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{worst ? `${worst.label} ${pct(worst.retained_pct)}` : '—'}</div>
        <div className="an-tile-cap">LOSES</div>
      </div>
    </div>
  );
}

function AttentionStory({ run }) {
  const dropsByBeat = new Map((run.drop_events ?? []).map((drop) => [drop.beat_id, drop]));
  return (
    <section className="an-story">
      <div className="an-story-head">
        <div>
          <div className="an-label">ATTENTION STORY</div>
          <p>Five viewers left. The wider room showed moments of hesitation before each exit.</p>
        </div>
        <div className="an-story-key"><i /> attention risk <b /> drop marker</div>
      </div>
      <div className="an-beat-rail" role="list" aria-label="Attention across script beats">
        {(run.beats ?? []).map((beat) => {
          const drop = dropsByBeat.get(beat.id);
          const risk = drop ? Math.min(1, (drop.attention_affected?.length ?? drop.seats_lost.length) / 5) : 0;
          return (
            <div className={`an-beat${drop ? ' has-drop' : ''}`} key={beat.id} role="listitem" title={`${formatRunTime(beat.start_sec)} · ${beat.text_span}`}>
              <span className="an-beat-fill" style={{ opacity: 0.18 + risk * 0.82 }} />
              <small>{String(beat.id).padStart(2, '0')}</small>
              {drop && <em>{drop.seats_lost.length}</em>}
            </div>
          );
        })}
      </div>
      <div className="an-story-foot"><span>OPEN</span><span>MIDPOINT</span><span>ENDING</span></div>
    </section>
  );
}

function formatRunTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function DropInsights({ run }) {
  if (!run?.drop_events?.length) return null;
  let remaining = run.summary.seats_total;
  return (
    <div className="an-block an-insights">
      <div className="an-label">WHERE ATTENTION DROPPED — AND WHY</div>
      {run.drop_events.map((drop) => {
        const lost = drop.seats_lost.length;
        const attentionAffected = drop.attention_affected?.length ?? lost;
        remaining -= lost;
        const percent = ((lost / run.summary.seats_total) * 100).toFixed(1);
        const action = run.notes.find((note) => note.anchored_to_drop === drop.id)?.text
          ?? run.room_synthesis?.recommended_fix;
        return (
          <article className="an-insight" key={drop.id}>
            <div className="an-insight-time">{formatRunTime(drop.timestamp)} · {percent}% physically left · {attentionAffected} attention signals</div>
            <div className="an-insight-title">{drop.reason_label}</div>
            <p>{drop.evidence}</p>
            <div className="an-insight-after">{remaining} of {run.summary.seats_total} still with you</div>
            {action && <div className="an-insight-action">Counter: {action}</div>}
          </article>
        );
      })}
    </div>
  );
}

/** THE GAP — intended tension (what the writer wrote) vs received attention
 *  (what the room gave). The shaded area is where attention fell below the
 *  writing: the thesis, made visual. Monochrome; live marker tracks the clock. */
function TheGap({ run, total }) {
  const { currentSeconds } = useClock();
  const W = 980, H = 300, padL = 58, padR = 24, padT = 20, padB = 44;
  const runDuration = run.script?.duration_sec;
  const x = (t) => padL + (t / total) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (H - padT - padB);

  const { intendedPath, attentionPath, gapPath, widest } = useMemo(() => {
    const beats = run.beats ?? [];
    const aud = run.audience ?? [];
    if (!beats.length || !aud.length) return { intendedPath: '', attentionPath: '', gapPath: '', widest: null };

    const NORM = 6; // ≈ max start_patience, normalises attention to 0..1
    let ten = 0.45;
    const intended = [];
    const attention = [];
    beats.forEach((b, i) => {
      ten = Math.max(0, Math.min(1, ten + (b.tension_delta || 0) * 0.11)); // the writer's arousal build
      intended.push(ten);
      const mean = aud.reduce((s, a) => s + (a.patience_trace[i] ?? 0), 0) / aud.length;
      attention.push(Math.max(0, Math.min(1, mean / NORM)));
    });

    const t = beats.map((b) => runSecToClock(b.start_sec, runDuration, total));
    const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'} ${x(t[i])} ${y(v)}`).join(' ');
    // gap polygon: top = intended, bottom = min(intended, attention) → fills only where attention is below
    const bot = intended.map((v, i) => Math.min(v, attention[i]));
    let gp = `M ${x(t[0])} ${y(intended[0])}`;
    for (let i = 1; i < t.length; i++) gp += ` L ${x(t[i])} ${y(intended[i])}`;
    for (let i = t.length - 1; i >= 0; i--) gp += ` L ${x(t[i])} ${y(bot[i])}`;
    gp += ' Z';

    let widest = null, mx = 0;
    beats.forEach((b, i) => {
      const g = intended[i] - attention[i];
      if (g > mx) { mx = g; widest = b; }
    });
    return { intendedPath: line(intended), attentionPath: line(attention), gapPath: gp, widest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, total, runDuration]);

  const mx = x(Math.max(0, Math.min(total, currentSeconds)));

  return (
    <div className="an-block">
      <div className="an-label">THE GAP · INTENDED TENSION vs RECEIVED ATTENTION</div>
      <svg className="an-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Intended tension versus received attention">
        {[0, 0.5, 1].map((v) => (
          <line key={v} className="an-grid" x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} />
        ))}
        <path className="an-gap-fill" d={gapPath} />
        <path className="an-line" d={intendedPath} />
        <path className="an-line an-line--thin" d={attentionPath} />
        <line className="an-marker" x1={mx} y1={padT} x2={mx} y2={H - padB} />
      </svg>
      <div className="an-gap-legend">
        <span><span className="sw sw-intended" /> intended tension</span>
        <span><span className="sw sw-attention" /> received attention</span>
        <span><span className="sw sw-gap" /> where the writing lost the room</span>
      </div>
      {widest && (
        <div className="an-gap-note">Widest gap: the {widest.type} at {formatRunTime(widest.start_sec)}</div>
      )}
    </div>
  );
}

/**
 * THE ANALYSIS PANEL — the backbone. Retention curve, per-segment small
 * multiples, and the key-metrics scorecard, all from the one simulation.
 */
export function AnalysisPanel() {
  const { timed, total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const { run } = useRun();

  if (!run?.summary) {
    return <div className="analysis-panel"><div className="an-head">ANALYSIS · THE ROOM, MEASURED</div></div>;
  }

  return (
    <div className="analysis-panel">
      <div className="an-head">ANALYSIS · THE ROOM, MEASURED</div>
      <div className="an-scroll">
        <Scorecard run={run} />
        <TheGap run={run} total={total} />
        <RetentionChart run={run} total={total} onSeek={(t) => clock.seek(t)} />
        <AttentionStory run={run} />
        <DropInsights run={run} />
        <CohortRetention cohorts={run.cohorts} />
      </div>
    </div>
  );
}
