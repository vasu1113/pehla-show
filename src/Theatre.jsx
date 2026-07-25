import { STAGE, allSeats } from './seatLayout';
import { figureFor, stateFor, ease } from './figures';

// ─────────────────────────────────────────────────────────────
// STEP 2: thirty people in the seats, who get up and walk out.
//
// THE ONE HARD RULE: this component keeps no timer. It receives
// `currentTime` and draws the room at that time. Feed it four
// minutes, it shows four minutes. Feed it two, everyone walks
// back in.
//
// Why: on stage you drag the scrubber backwards and replay the
// walkout three times while talking over it. That only works if
// the component has no memory.
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

// Crude on purpose, and seen from behind. Head, shoulders, a suggestion
// of a back. No legs — a figure that slides while bobbing slightly reads
// perfectly well at a tenth of the effort of articulated walking.
function Body({ silhouette }) {
  return (
    <g>
      {/* shoulders / back */}
      <path
        d={
          silhouette === 'broad'
            ? 'M -11 6 C -11 -3, -7 -7, 0 -7 C 7 -7, 11 -3, 11 6 Z'
            : silhouette === 'hunched'
            ? 'M -8 6 C -9 -1, -6 -4, 0 -4.5 C 6 -4, 9 -1, 8 6 Z'
            : 'M -8.5 6 C -8.5 -2, -5.5 -6, 0 -6 C 5.5 -6, 8.5 -2, 8.5 6 Z'
        }
        fill="var(--bone-dim)"
      />
      {/* head */}
      <circle
        cx={0}
        cy={silhouette === 'hunched' ? -9 : -11.5}
        r={4.6}
        fill="var(--bone-dim)"
      />
      {silhouette === 'ponytail' && (
        <path d="M 3.6 -13 C 7 -12, 7.5 -7, 5.5 -4"
              stroke="var(--bone-dim)" strokeWidth={2.6}
              strokeLinecap="round" fill="none" />
      )}
      {silhouette === 'cap' && (
        <path d="M -5 -13.4 A 5 5 0 0 1 5 -13.4 L 7.5 -12.6 L -5 -12.6 Z"
              fill="var(--bone-dim)" />
      )}
    </g>
  );
}

function Person({ seat, member, currentTime, onSeatClick }) {
  const fig = figureFor(seat.index);
  const { state, t } = stateFor(seat.index, member?.left_at_sec, currentTime);

  if (state === 'gone') return null;

  // Slow breathing, each on its own rhythm. Only while seated —
  // people who are leaving have other things on their mind.
  const breath =
    state === 'here'
      ? Math.sin((currentTime / fig.breathPeriod) * Math.PI * 2 + fig.breathPhase) * 0.5
      : 0;

  let dx = fig.dx;
  let dy = -2 + breath;
  let opacity = 1;

  if (state === 'leaving') {
    const e = ease(t);
    // Stand, shuffle to the aisle, then walk down and out while fading.
    dy += -5 * Math.min(1, t * 3);              // stand up
    dx += fig.exitDir * 34 * e;                  // sideways to the aisle
    dy += 30 * Math.max(0, e - 0.35) * 1.4;      // then down and away
    dy += Math.sin(t * 22) * 0.9;                // a slight bob while moving
    opacity = 1 - Math.max(0, (t - 0.45) / 0.55);
  }

  return (
    <g
      transform={`translate(${seat.x} ${seat.y}) rotate(${seat.rotation}) scale(${
        seat.scale * fig.heightScale
      })`}
      style={{ cursor: member ? 'pointer' : 'default' }}
      onClick={() => onSeatClick?.(seat.index)}
    >
      <g transform={`translate(${dx} ${dy})`} opacity={opacity}>
        <Body silhouette={fig.silhouette} />
      </g>
    </g>
  );
}

export default function Theatre({
  showIndex = false,
  audience = [],
  currentTime = 0,
  onSeatClick,
  highlightSeat = null,
}) {
  const seats = allSeats();
  const bySeat = new Map(audience.map((m) => [m.seat, m]));

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

      {/* the seats — empty ones stay visible after their person leaves */}
      <g>
        {seats.map((s) => (
          <Seat key={s.index} {...s} showIndex={showIndex} />
        ))}
      </g>

      {/* whoever is still in them */}
      <g>
        {seats.map((s) => (
          <Person
            key={`p${s.index}`}
            seat={s}
            member={bySeat.get(s.index)}
            currentTime={currentTime}
            onSeatClick={onSeatClick}
          />
        ))}
      </g>

      {/* the seat you're inspecting */}
      {highlightSeat != null && seats[highlightSeat] && (
        <circle
          cx={seats[highlightSeat].x}
          cy={seats[highlightSeat].y}
          r={26 * seats[highlightSeat].scale}
          fill="none"
          stroke="var(--beam)"
          strokeWidth={1.4}
          opacity={0.65}
        />
      )}
    </svg>
  );
}
