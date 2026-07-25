/**
 * A single audience member — a detailed little figure seen from behind-above,
 * the way you see a row in front of you at the cinema. Monochrome, in the
 * cinema palette, with a soft rim light off the screen.
 *
 * `tone` (0..1) subtly varies how strongly the figure reads, for depth.
 * Later props (a `pose`) will drive B6 body language; for NX1 they just sit.
 */
export function Figure({ tone = 0.85 }) {
  return (
    <svg className="figure-svg" viewBox="0 0 44 64" width="44" height="64" style={{ opacity: tone }}>
      {/* cast shadow on the floor */}
      <ellipse className="fig-shadow" cx="22" cy="61" rx="15" ry="4" />

      {/* torso / shoulders — a folded, upholstered silhouette */}
      <path
        className="fig-body"
        d="M7 62 C6 44 12 37 22 36 C32 37 38 44 37 62 Z"
      />
      {/* shoulder seam, gives the back some form */}
      <path className="fig-seam" d="M12 46 C16 42 28 42 32 46" />

      {/* neck */}
      <path className="fig-neck" d="M18 37 L18 31 L26 31 L26 37 Z" />

      {/* head */}
      <ellipse className="fig-head" cx="22" cy="23" rx="9.5" ry="10.5" />
      {/* hair line / crown */}
      <path className="fig-hair" d="M13 22 C13 12 31 12 31 22 C27 18 17 18 13 22 Z" />
      {/* rim light off the screen, one side */}
      <path className="fig-rim" d="M13.5 24 C13 17 15 14 18 13 C15 16 14.5 20 15 24 Z" />
    </svg>
  );
}
