import React, { useState } from 'react';

function ScenarioCard({ title, description, buttonText, onRun, loading }) {
  return (
    <div style={{ backgroundColor: 'var(--ink)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '1rem' }}>
      <h4 style={{ margin: '0 0 0.25rem 0' }}>{title}</h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{description}</p>
      <button 
        onClick={onRun} 
        disabled={loading}
        style={{ width: '100%', backgroundColor: 'var(--surface)', color: 'var(--white)', border: '1px solid var(--line)' }}
      >
        {loading ? 'Running...' : buttonText}
      </button>
    </div>
  );
}

export default function ScenarioSimulator({ onSimulate }) {
  const [loading, setLoading] = useState(false);
  
  const handleSimulate = async (scenario) => {
    setLoading(true);
    await onSimulate(scenario);
    setLoading(false);
  };
  
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Scenario Simulator</div>
      
      <ScenarioCard 
        title="Passive consumption" 
        description="3 watches / 0 actions" 
        buttonText="Run scenario" 
        onRun={() => handleSimulate('stall')}
        loading={loading}
      />
      
      <button 
        onClick={() => handleSimulate('reset')}
        disabled={loading}
        style={{ width: '100%', backgroundColor: 'transparent', color: 'var(--warning)', border: '1px solid var(--warning)' }}
      >
        Reset State
      </button>
    </div>
  );
}
