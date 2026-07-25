import { useState } from 'react';
import Theatre from './Theatre';

export default function App() {
  const [showIndex, setShowIndex] = useState(false);

  return (
    <div className="stage">
      <div className="stage-inner">
        <Theatre showIndex={showIndex} />
        <div className="caption">
          <span>Pehla Show / step 1 / 30 seats</span>
          <button
            onClick={() => setShowIndex(v => !v)}
            style={{
              background: 'none',
              border: '1px solid var(--bone-faint)',
              color: 'var(--bone-faint)',
              font: 'inherit',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {showIndex ? 'hide' : 'show'} seat numbers
          </button>
        </div>
      </div>
    </div>
  );
}
