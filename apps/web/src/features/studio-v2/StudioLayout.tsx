'use client';

import React, { ReactNode } from 'react';
import { StudioAssetNav } from './StudioAssetNav';
import { StudioRightPanel } from './StudioRightPanel';
import type { ProductionStateDTO } from '@scu/shared-types';

interface StudioLayoutProps {
  locale: string;
  projectId: string;
  state: ProductionStateDTO | null;
  stateError?: string | null;
  onRetryState?: () => void;
  children: ReactNode;
}

export function StudioLayout({ locale, projectId, state, stateError = null, onRetryState, children }: StudioLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1680px',
          margin: '0 auto',
          padding: '2rem',
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr) 340px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            position: 'sticky',
            top: '2rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-lg)',
            background: 'var(--bg-panel)',
            padding: '1rem',
          }}
        >
          <StudioAssetNav locale={locale} projectId={projectId} />
        </aside>
        <main style={{ minWidth: 0 }}>{children}</main>
        <StudioRightPanel
          locale={locale}
          projectId={projectId}
          state={state}
          stateError={stateError}
          onRetryState={onRetryState}
        />
      </div>
    </div>
  );
}
