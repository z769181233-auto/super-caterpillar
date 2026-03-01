'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PageShell } from '@/components/system/PageShell';
import { EmptyState } from '@/components/system/EmptyState';
import { ErrorState } from '@/components/system/ErrorState';
import { useStudioRequestState } from '../hooks/useStudioRequestState';
import { StudioShellSkeleton } from '../components/StudioShellSkeleton';
import { StudioWorkspace } from '../components/StudioWorkspace';
import { fetchBuildStudio } from '../api';

export function StudioShellPage() {
  const params = useParams();
  const studioId = params.id as string;

  const s = useStudioRequestState(studioId);

  const loadData = async () => {
    s.setJobQuery((prev) => ({ ...prev, status: 'loading' }));
    try {
      const data = await fetchBuildStudio(studioId);
      if (!data) {
        s.setJobQuery({ status: 'empty', data: null, error: null });
      } else {
        s.setJobQuery({ status: 'success', data: data.summary, error: null });
        s.setShotQuery({ status: 'success', data: data.tree, error: null });
      }
    } catch (err: any) {
      s.setJobQuery({
        status: 'error',
        data: null,
        error: err,
        traceId: 'ST-BL-' + studioId,
      });
    }
  };

  useEffect(() => {
    if (studioId) {
      loadData();
    }
  }, [studioId]);

  // Handle high-level phases
  if (s.phase === 'loading') {
    return <StudioShellSkeleton />;
  }

  return (
    <PageShell
      maxWidth="100%" // Studio is immersive
      className="studio-immersive-shell"
      style={{ padding: 0 }} // Immersive layout
    >
      {s.phase === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={loadData} />
      ) : s.phase === 'empty' ? (
        <EmptyState
          title="Studio Job Not Found"
          description="The request job data is missing or has been expired."
          actionText="Return to Projects"
          onAction={() => (window.location.href = '/projects')}
        />
      ) : s.phase === 'permission' ? (
        <ErrorState error="Access Denied" traceId={s.traceId} />
      ) : s.phase === 'offline' ? (
        <div style={{ height: '100vh' }}>
          <ErrorState error="You are offline" onRetry={loadData} />
        </div>
      ) : (
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <StudioWorkspace data={s.data} />

          {s.isPartial && (
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
              <ErrorState
                error="Shot sequence failed to load"
                onRetry={() => console.log('retry shots')}
                traceId={s.traceId}
                compact
              />
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
