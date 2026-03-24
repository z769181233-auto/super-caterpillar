'use client';

import React from 'react';
import { StudioShell } from './StudioShell';
import { BuildSummary, InsightsPayload, ScriptNode } from '../types';

interface StudioWorkspaceProps {
  data: {
    job?: BuildSummary | null;
    shots?: ScriptNode[] | null;
    insights?: InsightsPayload | null;
  };
}

export function StudioWorkspace({ data }: StudioWorkspaceProps) {
  if (!data.job) {
    return null;
  }

  // In P10.3, we focus on high-fidelity wrapping of existing Studio logic.
  // The visual polish (glass/motion) is inherited from PageShell and Global CSS tokens.
  return (
    <div className="animate-fade-in" style={{ height: '100%', width: '100%' }}>
      <StudioShell
        summary={data.job}
        tree={data.shots ?? []}
        insights={data.insights ?? { topCharacters: [] }}
        onSelectShot={(id) => console.log('select', id)}
      />
    </div>
  );
}
