'use client';

import { useState, useCallback } from 'react';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

interface RequestState<T> {
  status: RequestStatus;
  data: T | null;
  error: Error | null;
  traceId?: string;
}

export function useRequestState<T>(
  initialData?: T | null,
  options?: {
    initialStatus?: RequestStatus;
    isEmpty?: (data: T | null) => boolean;
    isPartial?: (data: T | null) => boolean;
  }
) {
  const [state, setState] = useState<RequestState<T>>({
    status: options?.initialStatus || (initialData ? 'success' : 'idle'),
    data: initialData || null,
    error: null,
  });

  const setLoading = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
  }, []);

  const setSuccess = useCallback(
    (data: T) => {
      const empty = options?.isEmpty
        ? options.isEmpty(data)
        : Array.isArray(data) && data.length === 0;
      setState({
        status: empty ? 'empty' : 'success',
        data,
        error: null,
      });
    },
    [options]
  );

  const setError = useCallback((error: Error, traceId?: string) => {
    setState((s) => ({
      ...s,
      status: 'error',
      error,
      traceId,
    }));
  }, []);

  const setEmpty = useCallback(() => {
    setState((s) => ({ ...s, status: 'empty', data: null, error: null }));
  }, []);

  const isPartial = options?.isPartial ? options.isPartial(state.data) : false;

  return {
    ...state,
    isPartial,
    setLoading,
    setSuccess,
    setError,
    setEmpty,
  };
}
