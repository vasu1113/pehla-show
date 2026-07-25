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
  const [tab, setTab] = useState('SCREENING');

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

  return (
    <div className="evidence-panel">
      <div className="ev-head">
        EVIDENCE · 
        <button 
          className={`ev-tab ${tab === 'SCREENING' ? 'active' : ''}`} 
          onClick={() => setTab('SCREENING')}
        >
          SCREENING
        </button>
        <button 
          className={`ev-tab ${tab === 'THE ROOM' ? 'active' : ''}`} 
          onClick={() => setTab('THE ROOM')}
        >
          THE ROOM
        </button>
      </div>
      <div className="ev-scroll">
        {tab === 'SCREENING' ? renderScreening() : renderTheRoom()}
      </div>
    </div>
  );
}
