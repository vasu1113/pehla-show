import { useState } from 'react';
import { useRun, runSecToClock } from '../../data/useRun';
import { clock, useClock } from '../../clock/useClock';
import './EvidencePanel.css';

function formatTime(sec) {
  if (sec == null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function EvidencePanel() {
  const { run, status } = useRun();
  const { duration } = useClock();
  const [tab, setTab] = useState('DROPS');

  if (status !== 'ready' || !run) {
    return (
      <div className="evidence-panel">
        <div className="ev-head">EVIDENCE</div>
        <div className="ev-scroll">no run</div>
      </div>
    );
  }

  const handleSeek = (runTimestamp) => {
    const clockSec = runSecToClock(runTimestamp, run.script.duration_sec, duration);
    if (clockSec != null) clock.seek(clockSec);
  };

  const renderScreening = () => {
    return run.drop_events.map((drop) => {
      const seatsLost = drop.seats_lost.length;
      const cohortBreakdown = Object.entries(drop.cohort_breakdown)
        .map(([cohort, count]) => `${cohort} x${count}`)
        .join(' · ');

      return (
        <div
          key={drop.id}
          className="ev-card"
          role="button"
          tabIndex={0}
          onClick={() => handleSeek(drop.timestamp)}
          onKeyDown={(e) => { 
            if (e.key === 'Enter' || e.key === ' ') { 
              e.preventDefault(); 
              handleSeek(drop.timestamp); 
            } 
          }}
        >
          <div className="ev-card-top">
            <span className="ev-time">{formatTime(drop.timestamp)}</span>
            <span className="ev-alert">{seatsLost} SEATS LOST</span>
          </div>
          <div className="ev-cohort">{cohortBreakdown}</div>
          <div className="ev-reason">{drop.reason_label}</div>
          <div className="ev-evidence"><i>{drop.evidence}</i></div>
          <button className="ev-fix-btn" tabIndex={-1}>{run.room_synthesis.recommended_fix}</button>
        </div>
      );
    });
  };

  const renderTheRoom = () => {
    const validNotes = run.notes.filter((n) => n.beat_id != null);
    
    const agentMap = {};
    run.agents.forEach(a => { agentMap[a.id] = a; });

    const notesByAgent = {};
    validNotes.forEach(n => {
      if (!notesByAgent[n.agent_id]) notesByAgent[n.agent_id] = [];
      notesByAgent[n.agent_id].push(n);
    });

    const conflicts = run.room_synthesis.conflict || [];

    const getBeatSec = (beatId) => {
      const beat = run.beats.find(b => b.id === beatId);
      return beat ? beat.start_sec : 0;
    };

    return (
      <>
        {conflicts.map((c, i) => {
          const beatSec = getBeatSec(c.beat_id);
          return (
            <div
              key={`conflict-${i}`}
              className="ev-card ev-conflict"
              role="button"
              tabIndex={0}
              onClick={() => handleSeek(beatSec)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' || e.key === ' ') { 
                  e.preventDefault(); 
                  handleSeek(beatSec); 
                } 
              }}
            >
              <div className="ev-conflict-title">CONFLICT</div>
              <div className="ev-pos">
                <span className="ev-agents">
                  {c.position_a.agents.map(aid => agentMap[aid]?.label || aid).join(', ')}
                </span>
                <span className="ev-claim">{c.position_a.claim}</span>
              </div>
              <div className="ev-pos">
                <span className="ev-agents">
                  {c.position_b.agents.map(aid => agentMap[aid]?.label || aid).join(', ')}
                </span>
                <span className="ev-claim">{c.position_b.claim}</span>
              </div>
            </div>
          );
        })}
        {Object.entries(notesByAgent).map(([agentId, notes]) => {
          const agent = agentMap[agentId];
          return (
            <div key={agentId} className="ev-agent-group">
              <div className="ev-agent-name">{agent?.label} ({agent?.lens})</div>
              {notes.map(note => {
                const beatSec = getBeatSec(note.beat_id);
                return (
                  <div
                    key={note.id}
                    className="ev-card ev-note"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSeek(beatSec)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter' || e.key === ' ') { 
                        e.preventDefault(); 
                        handleSeek(beatSec); 
                      } 
                    }}
                  >
                    <div className="ev-note-label">BEAT {note.beat_id} · {note.note_label}</div>
                    <div className="ev-text">{note.text}</div>
                    <div className="ev-evidence"><i>{note.evidence}</i></div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </>
    );
  };

  const renderSuggestions = () => {
    const consensus = run.room_synthesis?.consensus ?? [];
    return run.drop_events.map((drop) => {
      const notes = run.notes.filter((note) => note.anchored_to_drop === drop.id);
      const agreement = consensus.find((item) => item.beat_id === drop.beat_id);
      const suggestion = notes[0]?.text ?? agreement?.claim ?? run.room_synthesis?.recommended_fix;
      const support = notes.map((note) => note.note_label).join(' · ');
      return (
        <div key={`fix-${drop.id}`} className="ev-card ev-note">
          <div className="ev-note-label">COUNTER THE {drop.reason_label.toUpperCase()} · {formatTime(drop.timestamp)}</div>
          <div className="ev-text">{suggestion}</div>
          {support && <div className="ev-cohort">Grounded in: {support}</div>}
          <div className="ev-evidence"><i>{drop.evidence}</i></div>
        </div>
      );
    });
  };

  return (
    <div className="evidence-panel">
      <div className="ev-head">
        EVIDENCE · 
        <button 
          className={`ev-tab ${tab === 'DROPS' ? 'active' : ''}`}
          onClick={() => setTab('DROPS')}
        >
          DROPS
        </button>
        <button 
          className={`ev-tab ${tab === 'SUGGESTIONS' ? 'active' : ''}`}
          onClick={() => setTab('SUGGESTIONS')}
        >
          SUGGESTIONS
        </button>
      </div>
      <div className="ev-scroll">
        {tab === 'DROPS' ? renderScreening() : renderSuggestions()}
      </div>
    </div>
  );
}
