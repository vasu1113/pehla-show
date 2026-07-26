import { useState } from 'react';
import { AnalysisPanel } from '../../analysis/AnalysisPanel';
import { EvidencePanel } from '../Evidence/EvidencePanel';
import { NotesPanel } from '../Notes/NotesPanel';
import { RoomVoices } from '../RoomVoices/RoomVoices';
import { ScriptPane } from '../ScriptPane';
import './PostScreen.css';

const TABS = [
  ['analysis', 'Chart'],
  ['voices', 'Voices'],
  ['evidence', 'Evidence'],
  ['notes', 'Notes'],
  ['script', 'Script'],
];

export function PostScreen() {
  const [tab, setTab] = useState('analysis');
  return (
    <aside className="post-screen">
      <div className="post-panel">
        <div className="post-tabs">
          {TABS.map(([id, label]) => (
            <button type="button" key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'analysis' && <AnalysisPanel />}
        {tab === 'voices' && <RoomVoices />}
        {tab === 'evidence' && <EvidencePanel />}
        {tab === 'notes' && <NotesPanel />}
        {tab === 'script' && <ScriptPane />}
      </div>
    </aside>
  );
}
