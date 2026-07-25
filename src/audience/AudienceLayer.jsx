import { useMemo } from 'react';
import { generateAudience } from './audienceData';
import { Figure } from './Figure';
import './AudienceLayer.css';

/**
 * NX1 — THE AUDIENCE LAYER. Thirty detailed figures walk in, take their seats,
 * and each shows a brief "coming in" expectation as they settle.
 *
 * This is the pre-film entrance: a one-shot intro, driven by staggered CSS
 * animation (no JS timer, no clock). The IN-FILM reactions (NX2) and the
 * end-of-film verdict (B6) are what read the clock — those come next.
 *
 * Remount (via a changing `key` from the parent) replays the arrivals.
 */
export function AudienceLayer() {
  const people = useMemo(() => generateAudience(), []);

  return (
    <div className="audience">
      <div className="audience-floor">
        {people.map((p) => (
          <div
            key={p.id}
            className="seat-slot"
            style={{
              // final resting place; the `arrive` animation walks in from sl/st
              left: `${p.fl}%`,
              top: `${p.ft}%`,
              transform: `translate(-50%, -50%) scale(${p.scale})`,
              zIndex: Math.round(p.ft), // nearer rows overlap farther ones
              '--fl': `${p.fl}%`,
              '--ft': `${p.ft}%`,
              '--sl': `${p.sl}%`,
              '--st': `${p.st}%`,
              '--d': `${p.delay}s`,
            }}
          >
            {p.showsBubble && (
              <div className="expectation-bubble" style={{ '--bd': `${p.bubbleDelay}s` }}>
                {p.expectation}
              </div>
            )}
            <Figure tone={p.tone} />
          </div>
        ))}
      </div>
    </div>
  );
}
