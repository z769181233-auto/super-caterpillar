'use client';

import React, { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PageShell } from '@/components/system/PageShell';
import { EmptyState } from '@/components/system/EmptyState';
import { ErrorState } from '@/components/system/ErrorState';
import { useRequestState } from '@/hooks/useRequestState';
import { ProjectDetailSkeleton } from '../components/ProjectDetailSkeleton';
import { ProjectDetailShell } from '@/features/project-detail/ProjectDetailShell';
import { getProjectDetail } from '@/features/project-detail/api';
import { ProjectDetailView } from '@/features/project-detail/adapters';
import {
  PROJECT_STATUS_POLL_INTERVAL_MS,
  shouldPollProjectDetail,
} from '../project-status-polling';

const projectDetailRequestOptions = {
  initialStatus: 'loading' as const,
  isEmpty: (data: ProjectDetailView | null) => !data,
};

export function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const s = useRequestState<ProjectDetailView>(null, projectDetailRequestOptions);
  const { setLoading, setEmpty, setSuccess, setError } = s;

  const fetchData = useCallback(async (background = false) => {
    if (!background) {
      setLoading();
    }
    try {
      const data = await getProjectDetail(projectId);
      if (!data) {
        if (!background) {
          setEmpty();
        }
      } else {
        setSuccess(data);
      }
    } catch (err) {
      if (!background) {
        setError(
          err instanceof Error ? err : new Error('Failed to load project'),
          'ERR_PJ_DETAIL_' + projectId
        );
      }
    }
  }, [projectId, setEmpty, setError, setLoading, setSuccess]);

  useEffect(() => {
    if (projectId) {
      void fetchData();
    }
  }, [fetchData, projectId]);

  useEffect(() => {
    if (s.status !== 'success' || !shouldPollProjectDetail(s.data)) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchData(true);
    }, PROJECT_STATUS_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchData, s.data, s.status]);

  return (
    <PageShell maxWidth="1200px">
      {s.status === 'loading' ? (
        <ProjectDetailSkeleton />
      ) : s.status === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={fetchData} />
      ) : s.status === 'empty' ? (
        <EmptyState
          title="Project not found"
          description="The project you are looking for might have been deleted or moved."
          actionText="Back to Projects"
          onAction={() => (window.location.href = '/projects')}
        />
      ) : (
        <div className="animate-fade-in">
          {/* Reuse existing ProjectDetailShell but wrapped in our new state management */}
          <ProjectDetailShell project={s.data} />

          {s.isPartial && (
            <div style={{ marginTop: '2rem' }}>
              <ErrorState
                error="Some project metadata failed to load"
                onRetry={fetchData}
                traceId={s.traceId}
              />
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
