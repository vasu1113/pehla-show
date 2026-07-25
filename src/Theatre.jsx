import { STAGE, allSeats } from './seatLayout';

// ─────────────────────────────────────────────────────────────
// STEP 1: seats on screen. No people, no animation, no data.
// The only job here is to make 30 positions look like a cinema
// rather than a spreadsheet.
// ─────────────────────────────────────────────────────────────

function Seat({ x, y, scale, rotation, index, showIndex }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>

      {/* cast shadow on the floor, slightly offset toward viewer */}
      <ellipse cx={0} cy={16} rx={17} ry={5}
               fill="#000" opacity={0.35} />

      {/* seat base / cushion, seen from above-behind */}
      <path
        d="M -15 6 Q -15 15 -10 16 L 10 16 Q 15 15 15 6 Z"
        fill="var(--ink-lift)"
        stroke="var(--bone-dim)" strokeWidth={1.4}
      />

      {/* backrest shell — two curves suggest a folded, upholstered form
          rather than a flat rounded box */}
      <path
        d="M -16 6
           C -17 -6, -14 -15, 0 -16
           C 14 -15, 17 -6, 16 6
           C 10 9, -10 9, -16 6 Z"
        fill="var(--ink-lift)"
        stroke="var(--bone-dim)" strokeWidth={1.6}
      />
      {/* inner seam line, gives the backrest a stitched/upholstered feel */}
      <path
        d="M -11 3 C -12 -6, -8 -12, 0 -12.5 C 8 -12, 12 -6, 11 3"
        fill="none" stroke="var(--bone-faint)" strokeWidth={1}
      />

      {/* armrests, angled slightly to match the backrest curve */}
      <path d="M -16 5 L -21 3" stroke="var(--bone-dim)"
            strokeWidth={2.2} strokeLinecap="round" />
      <path d="M 16 5 L 21 3" stroke="var(--bone-dim)"
            strokeWidth={2.2} strokeLinecap="round" />

      {showIndex && (
        <text x={0} y={-1} textAnchor="middle"
              fontSize={10} fill="var(--bone-faint)"
              fontFamily="ui-monospace, monospace"
              transform={`rotate(${-rotation})`}>
          {index}
        </text>
      )}
    </g>
  );
}

export default function Theatre({ showIndex = false }) {
  const seats = allSeats();

  return (
    <svg
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      width="100%"
      style={{ display: 'block' }}
    >
      {/* the hall */}
      <rect width={STAGE.width} height={STAGE.height} fill="var(--ink)" />

      {/* the floor: a subtle lift so the seating area reads as a raked floor */}
      <path
        d="M 240 275 L 660 275 L 900 600 L 0 600 Z"
        fill="var(--ink-lift)"
      />

      {/* the screen */}
      <g>
        <rect x={190} y={60} width={520} height={170} rx={2}
              fill="var(--bone)" opacity={0.10} />
        <rect x={190} y={60} width={520} height={170} rx={2}
              fill="none" stroke="var(--bone-faint)" strokeWidth={1.5} />
      </g>

      {/* the audience */}
      <g>
        {seats.map((s) => (
          <Seat key={s.index} {...s} showIndex={showIndex} />
        ))}
      </g>
    </svg>
  );
}
