'use client';

import React, { useEffect } from 'react';
import { PageShell } from '@/components/system/PageShell';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';
import { EmptyState } from '@/components/system/EmptyState';
import { ErrorState } from '@/components/system/ErrorState';
import { useRequestState } from '@/hooks/useRequestState';
import { ProjectsGrid } from './ProjectsGrid';
import { ProjectsHeader } from './ProjectsHeader';

// Mock hook for demonstration, replace with actual implementation later
function useProjectsQuery() {
  // Simulate loading for the template demo
  return {
    data: null,
    loading: true,
    error: null,
    refetch: () => console.log('refetching...'),
  };
}

export function ProjectsGridPage() {
  const query = useProjectsQuery();
  const s = useRequestState<any>(null, {
    initialStatus: 'loading',
    isEmpty: (data) => !data || (Array.isArray(data) && data.length === 0),
  });

  // Mocking the data flow for the template
  useEffect(() => {
    const timer = setTimeout(() => {
      // Uncomment to test different states
      // s.setSuccess([]); // Empty state
      // s.setError(new Error('API Timeout'), 'ERR_504_XYZ'); // Error state
      s.setSuccess([{ id: '1', title: 'Example Project', status: 'active' }]); // OK state
    }, 1500);
    return () => clearTimeout(timer);
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
