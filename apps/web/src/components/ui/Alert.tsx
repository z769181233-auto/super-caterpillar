import React, { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  icon?: string;
  variant?: 'warning' | 'info';
}

export function Alert({ children, icon, variant = 'warning' }: AlertProps) {
  const isWarning = variant === 'warning';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: 'var(--r-md)',
        background: 'var(--bg-card)',
        border: '1px solid',
        borderColor: isWarning ? 'var(--text-secondary)' : 'var(--border-subtle)', // Avoid red/green colors
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}
    >
      <div style={{ flexShrink: 0, fontSize: '1.25rem' }}>{icon || (isWarning ? '⚠️' : 'ℹ️')}</div>
      <div>{children}</div>
    </div>
  );
}
