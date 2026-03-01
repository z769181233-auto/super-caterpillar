'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface ErrorStateProps {
  error: Error | string | null;
  traceId?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ error, traceId, onRetry, compact = false }: ErrorStateProps) {
  const errorMessage =
    typeof error === 'string' ? error : error?.message || 'Unknown error occurred';

  if (compact) {
    return (
      <div
        className="glass-2 border border-red-900/30 p-4 rounded-xl flex items-center gap-4 animate-slide-up"
        style={{ pointerEvents: 'auto' }}
      >
        <div style={{ color: '#ff4444', fontSize: '1.2rem' }}>⚠️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#fff' }}>{errorMessage}</div>
          {traceId && (
            <div style={{ fontSize: '0.65rem', opacity: 0.5, fontFamily: 'monospace' }}>
              ID: {traceId}
            </div>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: '#fff',
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-center flex-col p-12 text-center animate-fade-in"
      style={{ gap: '1.5rem', minHeight: '300px' }}
    >
      <div className="text-error" style={{ fontSize: '3rem' }}>
        ⚠️
      </div>
      <div style={{ maxWidth: '400px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Something went wrong
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {errorMessage}
        </p>
        {traceId && (
          <div
            style={{
              fontSize: '0.75rem',
              padding: '0.5rem',
              background: 'rgba(255,0,0,0.05)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
          >
            Trace ID: {traceId}
          </div>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
