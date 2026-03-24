'use client';

import { useState, useCallback, useMemo } from 'react';

export type StudioPhase = 'loading' | 'ready' | 'empty' | 'error' | 'permission' | 'offline';

type StudioQueryStatus = 'loading' | 'success' | 'empty' | 'error';

interface StudioQueryError {
  message?: string;
  status?: number;
}

interface StudioQueryState<TData> {
  status: StudioQueryStatus;
  data: TData | null;
  error: StudioQueryError | null;
  traceId?: string;
}

export function useStudioRequestState(studioId: string) {
  const [jobQuery, setJobQuery] = useState<StudioQueryState<unknown>>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [shotQuery, setShotQuery] = useState<StudioQueryState<unknown>>({
    status: 'loading',
    data: null,
    error: null,
  });

  // Combined Phase logic
  const phase = useMemo((): StudioPhase => {
    // High priority: Permission & Network
    if (typeof window !== 'undefined' && !window.navigator.onLine) return 'offline';

    // Blocking: Job check
    if (jobQuery.status === 'loading') return 'loading';
    if (jobQuery.status === 'error') {
      if (jobQuery.error?.status === 403) return 'permission';
      return 'error';
    }
    if (jobQuery.status === 'empty' || !jobQuery.data) return 'empty';

    // Ready state
    return 'ready';
  }, [jobQuery]);

  const isPartial = useMemo(() => {
    return phase === 'ready' && shotQuery.status === 'error';
  }, [phase, shotQuery]);

  const traceId = jobQuery.traceId || 'PJ-STUDIO-' + studioId;

  const retryAll = useCallback(() => {
    console.log('Retrying all studio data sources for', studioId);
    // Implement actual refetch logic here
  }, [studioId]);

  return {
    phase,
    data: {
      job: jobQuery.data,
      shots: shotQuery.data,
    },
    error: jobQuery.error || shotQuery.error,
    traceId,
    isPartial,
    retryAll,
    setJobQuery,
    setShotQuery,
  };
}
