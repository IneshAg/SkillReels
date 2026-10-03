import React from 'react';

function Meter({ label, value }) {
  // Max out at 5 for prototype visualization
  const percent = Math.min((value / 5) * 100, 100);
  
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{value}</span>
      </div>
      <div style={{ height: '8px', backgroundColor: 'var(--ink)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, backgroundColor: 'var(--indigo)', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

export default function EvidenceView({ state }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Evidence Ladder</div>
      <Meter label="Exposure" value={state.evidence_exposure} />
      <Meter label="Concept" value={state.evidence_concept} />
      <Meter label="Application" value={state.evidence_application} />
      <Meter label="Build" value={state.evidence_build} />
    </div>
  );
}
