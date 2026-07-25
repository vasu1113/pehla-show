import { useMemo } from 'react';
import { clock, useClock } from '../clock/useClock';
import { FILM_CHUNKS, buildTimeline } from '../film/filmData';
import { generateAudience } from '../audience/audienceData';
import {
  runSimulation,
  retentionSeries,
  retentionByType,
  walkoutEvents,
  analysisMetrics,
  retentionAt,
} from './simulation';
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
function RetentionChart({ sims, timed, total, onSeek }) {
  const { currentSeconds } = useClock();
  const W = 320, H = 150, padL = 30, padR = 12, padT = 12, padB = 22;
  const x = (t) => padL + (t / total) * (W - padL - padR);
  const y = (v) => padT + (1 - v) * (H - padT - padB);

  const { path, dots } = useMemo(() => {
    const pts = retentionSeries(sims, timed);
    const evs = walkoutEvents(sims, timed);
    return {
      path: stepPath(pts, x, y),
      dots: evs.map((e) => ({ ...e, cx: x(e.time), cy: y(retentionAt(sims, e.time + 0.01)) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sims, timed, total]);

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
function SmallMultiples({ sims, timed, total }) {
  const byType = useMemo(() => retentionByType(sims, timed), [sims, timed]);
  const W = 150, H = 34, padB = 3;
  const x = (t) => (t / total) * W;
  const y = (v) => padB + (1 - v) * (H - padB * 2);

  return (
    <div className="an-block">
      <div className="an-label">BY LISTENER TYPE</div>
      <div className="an-multiples">
        {byType.map((s) => (
          <div className="an-mult" key={s.type}>
            <div className="an-mult-head">
              <span className="an-mult-type">{s.type}</span>
              <span className="an-mult-val">{pct0(s.points[s.points.length - 1].value)}</span>
            </div>
            <svg className="an-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <line className="an-grid" x1="0" y1={y(0)} x2={W} y2={y(0)} />
              <path className="an-line an-line--thin" d={stepPath(s.points, x, y)} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/** AN.5 — the scorecard a stakeholder acts on. */
function Scorecard({ metrics }) {
  const m = metrics;
  return (
    <div className="an-scorecard">
      <div className="an-tile an-tile--hero">
        <div className="an-tile-val">{pct(m.finalRetention)}</div>
        <div className="an-tile-cap">STAYED TO THE END · {m.stayed}/{m.n}</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{m.verdict}</div>
        <div className="an-tile-cap">PREDICTED VERDICT</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">
          {m.biggest ? `${m.biggest.count} @ ${m.biggest.chunkType}` : '—'}
        </div>
        <div className="an-tile-cap">BIGGEST DROP-OFF</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{m.best.type} {pct0(m.best.retention)}</div>
        <div className="an-tile-cap">BEST SEGMENT</div>
      </div>
      <div className="an-tile">
        <div className="an-tile-val an-tile-val--sm">{m.worst.type} {pct0(m.worst.retention)}</div>
        <div className="an-tile-cap">LOSES</div>
      </div>
    </div>
  );
}

/**
 * THE ANALYSIS PANEL — the backbone. Retention curve, per-segment small
 * multiples, and the key-metrics scorecard, all from the one simulation.
 */
export function AnalysisPanel() {
  const { timed, total } = useMemo(() => buildTimeline(FILM_CHUNKS), []);
  const sims = useMemo(() => runSimulation(generateAudience(), timed), [timed]);
  const metrics = useMemo(() => analysisMetrics(sims, timed), [sims, timed]);

  return (
    <div className="analysis-panel">
      <div className="an-head">ANALYSIS · THE ROOM, MEASURED</div>
      <div className="an-scroll">
        <Scorecard metrics={metrics} />
        <RetentionChart sims={sims} timed={timed} total={total} onSeek={(t) => clock.seek(t)} />
        <SmallMultiples sims={sims} timed={timed} total={total} />
      </div>
    </div>
  );
}
