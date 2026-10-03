import React from 'react';
import StateSummary from './StateSummary';
import EvidenceView from './EvidenceView';
import ScenarioSimulator from './ScenarioSimulator';

export default function JudgeView({ state, policy, onSimulate }) {
  if (!state) return null;
  
  return (
    <aside style={{ width: '400px', borderLeft: '1px solid var(--line)', backgroundColor: 'var(--surface)', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--warning)', letterSpacing: '0.05em' }}>SYSTEM VIEW</h2>
      
      <StateSummary state={state} policy={policy} />
      <EvidenceView state={state} />
      <ScenarioSimulator onSimulate={onSimulate} />
      
    </aside>
  );
}
