import React from 'react';

interface KpiStatProps {
  label: string;
  value: string | number;
  suffix?: string;
}

export function KpiStat({ label, value, suffix }: KpiStatProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}
