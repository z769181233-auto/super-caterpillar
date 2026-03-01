'use client';

import React from 'react';
import { StudioShell } from './StudioShell';

interface StudioWorkspaceProps {
  data: any;
}

export function StudioWorkspace({ data }: StudioWorkspaceProps) {
  // In P10.3, we focus on high-fidelity wrapping of existing Studio logic.
  // The visual polish (glass/motion) is inherited from PageShell and Global CSS tokens.
  return (
    <div className="animate-fade-in" style={{ height: '100%', width: '100%' }}>
      <StudioShell
        summary={data.job}
        tree={data.shots || { episodes: [] }}
        insights={{ topCharacters: [] }}
        onSelectShot={(id) => console.log('select', id)}
      />
    </div>
  );
}
