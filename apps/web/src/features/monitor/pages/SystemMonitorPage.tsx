'use client';

import React, { useEffect } from 'react';
import { PageShell } from '@/components/system/PageShell';
import { useRequestState } from '@/hooks/useRequestState';
import { SystemMonitorSkeleton } from '../components/SystemMonitorSkeleton';
import { getOrchestratorMonitorStats } from '@/lib/apiClient';
import { ErrorState } from '@/components/system/ErrorState';
import { EmptyState } from '@/components/system/EmptyState';

export function SystemMonitorPage() {
  const s = useRequestState<any>(null);

  const loadStats = async () => {
    s.setLoading();
    try {
      const result = await getOrchestratorMonitorStats();
      if (!result.data) {
        s.setEmpty();
      } else {
        s.setSuccess(result.data);
      }
    } catch (err: any) {
      s.setError(err, 'MON-SCH-' + Date.now().toString().slice(-6));
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // 10s refresh for monitor
    return () => clearInterval(interval);
  }, []);

  if (s.status === 'loading') {
    return <SystemMonitorSkeleton />;
  }

  const stats = s.data || {};

  return (
    <PageShell maxWidth="1200px" className="system-monitor-page">
      {s.status === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={loadStats} />
      ) : s.status === 'empty' ? (
        <EmptyState
          title="No Metrics Available"
          description="The orchestrator has not reported any metrics yet."
          onAction={loadStats}
          actionText="Retry Fetching"
        />
      ) : (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #fff, #999)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Orchestrator Health Monitor
            </h1>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Auto-refreshing every 10s
            </div>
          </div>

          {/* Job Status Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem' }}>
            {[
              { label: 'Pending', value: stats.jobs?.pending || 0, color: 'var(--text-muted)' },
              { label: 'Running', value: stats.jobs?.running || 0, color: '#FF9800' },
              { label: 'Retrying', value: stats.jobs?.retrying || 0, color: '#2196F3' },
              { label: 'Failed', value: stats.jobs?.failed || 0, color: '#F44336' },
              { label: 'Succeeded', value: stats.jobs?.succeeded || 0, color: '#4CAF50' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '1.5rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Worker Section */}
          <div
            style={{
              padding: '2rem',
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              Worker Fleet Distribution
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Total Workers
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  {stats.workers?.total || 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Online</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#4CAF50' }}>
                  {stats.workers?.online || 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Busy</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#FF9800' }}>
                  {stats.workers?.busy || 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Idle</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {stats.workers?.idle || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Queue Insights */}
          <div
            style={{
              padding: '2rem',
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              Real-time Queue Performance
            </h2>
            <div style={{ display: 'flex', gap: '4rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Avg Wait Time
                </div>
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stats.queue?.avgWaitTimeSeconds?.toFixed(1) || '0.0'}
                  <small
                    style={{ fontSize: '1rem', marginLeft: '0.25rem', color: 'var(--text-muted)' }}
                  >
                    sec
                  </small>
                </div>
              </div>
              {/* Potential Partial State Illustration */}
              {!stats.queue?.latencyP95 && (
                <div
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(244,67,54,0.1)',
                    border: '1px solid rgba(244,67,54,0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    alignSelf: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#F44336' }}>
                    ⚠️ Latency P95 currently unavailable from high-speed buffer.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
