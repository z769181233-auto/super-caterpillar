import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { getProjectEvidenceSummary } from './api';
import { EvidenceSummaryView } from './adapters';

export function ProjectEvidencePanel({ projectId }: { projectId: string }) {
  const t = useTranslations('ProjectDetail');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EvidenceSummaryView | null>(null);

  useEffect(() => {
    getProjectEvidenceSummary(projectId).then((res) => {
      setSummary(res);
      setLoading(false);
    });
  }, [projectId]);

  return (
    <Card style={{ padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t('navEvidence')}
        </h2>
        <Button variant="secondary" onClick={() => {}}>
          {t('ctaExportCsv')}
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>
          {t('loading', { defaultValue: 'Loading...' })}
        </div>
      ) : summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
            <StatusPill level={summary.status === 'Verified' ? 'GOLD' : 'DEFAULT'}>
              {summary.status}
            </StatusPill>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1fr) 3fr',
              gap: '1.5rem',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '1.5rem',
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>GlobalHash</div>
            {!summary.globalHash || summary.globalHash.source === 'missing' ? (
              <div style={{ color: 'var(--text-muted)' }}>--</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    background: 'var(--bg-panel)',
                    padding: '0.5rem',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {summary.globalHash.value}
                </div>
                {summary.globalHash.source === 'derived' && (
                  <StatusPill level="DEFAULT">Derived</StatusPill>
                )}
              </div>
            )}

            <div style={{ color: 'var(--text-secondary)' }}>Content ID (CID)</div>
            {!summary.cid || summary.cid.source === 'missing' ? (
              <div style={{ color: 'var(--text-muted)' }}>--</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    background: 'var(--bg-panel)',
                    padding: '0.5rem',
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {summary.cid.value}
                </div>
                {summary.cid.source === 'derived' && (
                  <StatusPill level="DEFAULT">Derived</StatusPill>
                )}
              </div>
            )}

            <div style={{ color: 'var(--text-secondary)' }}>BuildID Reference</div>
            {!summary.buildId || summary.buildId.source === 'missing' ? (
              <div style={{ color: 'var(--text-muted)' }}>--</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {summary.buildId.value}
                </div>
                {summary.buildId.source === 'derived' && (
                  <StatusPill level="DEFAULT">Derived</StatusPill>
                )}
              </div>
            )}

            <div style={{ color: 'var(--text-secondary)' }}>Last Generated</div>
            <div style={{ color: 'var(--text-primary)' }}>
              {summary.lastGeneratedAt !== '--'
                ? new Date(summary.lastGeneratedAt).toLocaleString()
                : '--'}
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <Button variant="secondary" onClick={() => window.open('/zh/studio/review', '_blank')}>
              {t('ctaReviewRaw', { defaultValue: 'Review Raw Evidence DB' })}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('empty', { defaultValue: 'No evidence yet.' })}
        </div>
      )}
    </Card>
  );
}
