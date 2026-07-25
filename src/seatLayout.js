// ─────────────────────────────────────────────────────────────
// SEAT LAYOUT
// The only file you should be editing while tuning step 1.
// Change a number, save, look. Repeat until the room feels real.
// ─────────────────────────────────────────────────────────────

export const STAGE = { width: 900, height: 600 };

export const LAYOUT = {
  rows: 5,
  seatsPerRow: 6,

  centerX: 450,

  // Row 0 is the FRONT row: nearest the screen, farthest from us,
  // so it sits higher up and renders smaller.
  frontRowY: 300,
  rowGap: 55,           // vertical distance between rows

  frontRowWidth: 330,   // how wide the front row spreads
  widthGrowth: 68,      // each row back is this much wider

  frontRowScale: 0.70,  // front row size
  scaleGrowth: 0.075,   // each row back grows by this

  curve: 2.2,           // how much the row arcs toward the viewer at the ends
};

export function seatPosition(index) {
  const { seatsPerRow, centerX, frontRowY, rowGap, frontRowWidth,
    widthGrowth, frontRowScale, scaleGrowth, curve } = LAYOUT;

  const row = Math.floor(index / seatsPerRow);
  const col = index % seatsPerRow;

  const rowWidth = frontRowWidth + row * widthGrowth;
  const spacing = rowWidth / (seatsPerRow - 1);

  // Distance from the middle of the row, in seat units.
  const offset = col - (seatsPerRow - 1) / 2;

  // The arc: seats at the ends of a row are closer to us, so they drop lower.
  const arc = offset * offset * curve;

  // Rotation: seats angle inward toward the screen, like a real fan-shaped
  // hall. Center seat faces straight ahead (0deg); end seats angle in.
  // ROTATION_SPAN controls how sharp the angling is at the row ends.
  const ROTATION_SPAN = 34; // degrees, tip of the outermost seat
  const maxOffset = (seatsPerRow - 1) / 2;
  // Negative sign: a seat to the right of center (positive offset) must
  // rotate counter-clockwise to angle its front back toward the middle
  // of the screen, and vice versa for the left side.
  const rotation = -(offset / maxOffset) * ROTATION_SPAN;

  return {
    row,
    col,
    x: centerX - rowWidth / 2 + col * spacing,
    y: frontRowY + row * rowGap + arc,
    scale: frontRowScale + row * scaleGrowth,
    rotation,
  };
}

export const SEAT_COUNT = LAYOUT.rows * LAYOUT.seatsPerRow;

export const allSeats = () =>
  Array.from({ length: SEAT_COUNT }, (_, i) => ({ index: i, ...seatPosition(i) }));
