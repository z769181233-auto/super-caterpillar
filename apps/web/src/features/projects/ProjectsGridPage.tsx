'use client';

import React, { useEffect } from 'react';
import { PageShell } from '@/components/system/PageShell';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';
import { EmptyState } from '@/components/system/EmptyState';
import { ErrorState } from '@/components/system/ErrorState';
import { useRequestState } from '@/hooks/useRequestState';
import { ProjectsGrid } from './ProjectsGrid';
import { ProjectsHeader } from './ProjectsHeader';

import { getProjects } from './api';
import { ProjectCardView } from './adapters';

export function ProjectsGridPage() {
  const s = useRequestState<ProjectCardView[]>(null, {
    initialStatus: 'loading',
    isEmpty: (data) => !data || (Array.isArray(data) && data.length === 0),
  });

  useEffect(() => {
    getProjects()
      .then((data) => s.setSuccess(data))
      .catch((err) => s.setError(err));
  }, []);

  return (
    <PageShell
      header={<ProjectsHeader onCreateClick={() => console.log('create')} />}
      maxWidth="1200px"
    >
      {s.status === 'loading' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <SkeletonBlock key={i} height="200px" />
          ))}
        </div>
      ) : s.status === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={() => window.location.reload()} />
      ) : s.status === 'empty' ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start the pipeline."
          actionText="Create Project"
          onAction={() => console.log('Create Project')}
        />
      ) : (
        <div className="animate-fade-in">
          <ProjectsGrid projects={s.data || []} isLoading={false} />
          {s.isPartial && (
            <div style={{ marginTop: '2rem' }}>
              <ErrorState
                error="Some projects failed to load"
                onRetry={() => console.log('retry partial')}
              />
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
