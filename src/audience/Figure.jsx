/**
 * An audience member — a little illustrated person (Humaaans-style: flat, warm,
 * rounded), seen from behind-above the way you see the row in front of you.
 * Individuality comes from hair / skin / clothing variants, so a seated crowd
 * reads as thirty different people, not thirty shadows.
 *
 * Kept to warm neutrals so it stays inside the cinema palette (no new hue).
 * Later a `pose` prop drives B6 body language; for now they sit.
 */

const SKINS = ['#cbb89d', '#b39c7e', '#9c8468', '#d6c3a6'];
const HAIRS = ['#17130f', '#2a2018', '#3a2b1e', '#4a3a2b'];
const CLOTHS = ['#26221c', '#1a1712', '#302b23', '#211d17', '#38322a'];

function Hair({ variant, color }) {
  const crown =
    'M12.5 24 C12 13 32 13 31.5 24 C31.5 27 29 30 26 31 L18 31 C15 30 12.5 27 12.5 24 Z';
  switch (variant) {
    case 1: // bun
      return (
        <g fill={color}>
          <path d={crown} />
          <ellipse cx="22" cy="11.5" rx="4" ry="3.6" />
        </g>
      );
    case 2: // short / cropped — more head visible
      return <path fill={color} d="M13 22 C13 14 31 14 31 22 C28 18 16 18 13 22 Z" />;
    case 3: // white cap (topi) — an elder
      return (
        <g>
          <path fill="#d9d2c4" d="M12.5 22 C13 13.5 31 13.5 31.5 22 C27 19.5 17 19.5 12.5 22 Z" />
          <rect x="12" y="21" width="20" height="2.2" rx="1.1" fill="#c3bba8" />
        </g>
      );
    case 4: // longer hair down the nape
      return (
        <g fill={color}>
          <path d={crown} />
          <path d="M15 29 L29 29 L27 38 L17 38 Z" />
        </g>
      );
    default: // full head of hair
      return <path fill={color} d={crown} />;
  }
}

export function Figure({ tone = 0.92, skin = 0, hair = 0, cloth = 0 }) {
  const s = SKINS[skin % SKINS.length];
  const h = HAIRS[hair % HAIRS.length];
  const c = CLOTHS[cloth % CLOTHS.length];
  return (
    <svg className="figure-svg" viewBox="0 0 44 64" width="44" height="64" style={{ opacity: tone }}>
      <ellipse className="fig-shadow" cx="22" cy="61" rx="15" ry="4" />

      {/* torso / shoulders */}
      <path
        d="M6 62 C5 43 12 37 22 36 C32 37 39 43 38 62 Z"
        fill={c}
        stroke="rgba(237,232,223,0.14)"
        strokeWidth="0.8"
      />

      {/* neck */}
      <rect x="18" y="30" width="8" height="8" rx="3" fill={s} />

      {/* ears + head */}
      <circle cx="12.6" cy="24" r="1.9" fill={s} />
      <circle cx="31.4" cy="24" r="1.9" fill={s} />
      <ellipse cx="22" cy="23" rx="9.5" ry="10.5" fill={s} />

      <Hair variant={hair} color={h} />

      {/* soft rim light off the screen */}
      <path className="fig-rim" d="M13.5 24 C13 17 15 14 18 13 C15 16 14.5 20 15 24 Z" />
    </svg>
  );
}
