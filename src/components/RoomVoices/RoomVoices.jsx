import { useMemo } from 'react';
import { useRun } from '../../data/useRun';
import './RoomVoices.css';

function beatLabel(run, beatId) {
  const beat = run.beats?.find((item) => item.id === beatId);
  return beat ? `Beat ${String(beat.index + 1).padStart(2, '0')} · ${beat.type}` : `Beat ${beatId}`;
}

function reactionTone(delta) {
  if (delta > 0) return 'is-pull';
  if (delta < 0) return 'is-push';
  return '';
}

/**
 * The complete record of what the room said. Unlike the drop-off report,
 * this remains valuable when every listener stays: the audience's exact
 * reactions and every critic's lens are both visible side by side.
 */
export function RoomVoices() {
  const { run, status } = useRun();
  const notesByAgent = useMemo(() => {
    const groups = new Map();
    for (const note of run?.notes ?? []) {
      const notes = groups.get(note.agent_id) ?? [];
      notes.push(note);
      groups.set(note.agent_id, notes);
    }
    return groups;
  }, [run]);

  if (status !== 'ready' || !run) {
    return <div className="room-voices"><div className="rv-head">ROOM VOICES</div></div>;
  }

  const agents = new Map((run.agents ?? []).map((agent) => [agent.id, agent]));
  const personaLabels = new Map((run.cohorts ?? []).map((cohort) => [cohort.id, cohort.label]));
  const reactions = [...(run.audience_reactions ?? [])]
    .sort((left, right) => left.timestamp - right.timestamp || left.cohort.localeCompare(right.cohort));
  const brief = run.room_synthesis;
  const highlights = [
    ['AUDIENCE READOUT', brief?.audience_readout || `${reactions.length} in-the-moment audience reactions were recorded.`],
    ['CRITIC READOUT', brief?.critic_readout || 'Read each critic’s independent notes below.'],
    ['WHY THIS HELPS A CREATOR', brief?.creator_value || 'Compare what people actually felt with the craft concerns behind the same beats.'],
    ['WHY RUN IT AGAIN', brief?.return_reason || 'After the next cut, compare the audience response and critical concerns beat by beat.'],
  ];

  return (
    <section className="room-voices">
      <div className="rv-head">ROOM VOICES · THE COMPLETE RECORD</div>
      <div className="rv-scroll">
        <div className="rv-highlights">
          {highlights.map(([label, text]) => (
            <article className="rv-highlight" key={label}>
              <div className="rv-label">{label}</div>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <p className="rv-intro">
          These are separate perspectives. A strong audience reaction does not erase a critic’s concern, and a critic’s concern does not mean the audience rejected the scene.
        </p>

        <div className="rv-columns">
          <section className="rv-column">
            <div className="rv-column-head">AUDIENCE · WHAT THEY SAID</div>
            {reactions.length ? reactions.map((reaction, index) => (
              <article className={`rv-card ${reactionTone(reaction.delta)}`} key={`${reaction.cohort}-${reaction.beat_id}-${index}`}>
                <div className="rv-card-meta">
                  <span>{personaLabels.get(reaction.cohort) || reaction.cohort}</span>
                  <span>{beatLabel(run, reaction.beat_id)}</span>
                </div>
                <blockquote>“{reaction.text}”</blockquote>
                <p className="rv-evidence">Grounded in: {reaction.evidence}</p>
              </article>
            )) : <p className="rv-empty">No audience reactions were returned for this run.</p>}
          </section>

          <section className="rv-column">
            <div className="rv-column-head">CRITICS · WHAT THEY SAID</div>
            {notesByAgent.size ? [...notesByAgent.entries()].map(([agentId, notes]) => {
              const agent = agents.get(agentId);
              return (
                <section className="rv-agent" key={agentId}>
                  <div className="rv-agent-head">
                    <span>{agent?.label || agentId}</span>
                    <small>{agent?.lens}</small>
                  </div>
                  {notes.map((note) => (
                    <article className="rv-card" key={note.id}>
                      <div className="rv-card-meta">
                        <span>{beatLabel(run, note.beat_id)}</span>
                        <span>{note.note_label} · {note.severity}/5</span>
                      </div>
                      <p className="rv-note">{note.text}</p>
                      <p className="rv-evidence">Evidence: {note.evidence}</p>
                    </article>
                  ))}
                </section>
              );
            }) : <p className="rv-empty">No critic notes were returned for this run.</p>}
          </section>
        </div>
      </div>
    </section>
  );
}
