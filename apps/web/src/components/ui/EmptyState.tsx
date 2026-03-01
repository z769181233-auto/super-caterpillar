import React, { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--r-lg)',
        border: '1px dashed var(--border-subtle)',
      }}
    >
      {icon ? (
        <div style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>{icon}</div>
      ) : (
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          📂
        </div>
      )}
      <h3
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          marginBottom: '2rem',
          maxWidth: '400px',
        }}
      >
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
