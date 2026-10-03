import React from 'react';

export default function StateSummary({ state, policy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Goal</div>
        <div style={{ fontWeight: '600' }}>{state.declared_goal}</div>
      </div>
      
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Recent Behavior</div>
        <div style={{ fontWeight: '600' }}>
          {state.passive_streak} watches / 0 actions
        </div>
      </div>

      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Current Policy</div>
        <div style={{ fontWeight: '600', color: policy === 'INTERVENTION_ACTIVE' ? 'var(--warning)' : 'var(--success)' }}>
          {policy === 'INTERVENTION_ACTIVE' ? 'CONSUMPTION_WITHOUT_PROGRESS' : 'NORMAL'}
        </div>
      </div>
    </div>
  );
}
