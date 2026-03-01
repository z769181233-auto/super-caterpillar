import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { getProjectBuilds } from './api';
import { BuildRowView } from './adapters';

export function ProjectBuildsPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('ProjectDetail');
  const [loading, setLoading] = useState(true);
  const [builds, setBuilds] = useState<BuildRowView[]>([]);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleComingSoon = () => setShowComingSoon(true);

  useEffect(() => {
    getProjectBuilds(projectId).then((res) => {
      setBuilds(res);
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
          {t('navBuilds')}
        </h2>
        <Button variant="primary" onClick={handleComingSoon}>
          {'+ ' + t('ctaNewBuild', { defaultValue: 'New Build' })}
        </Button>
      </div>

      {showComingSoon && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <Card
            style={{
              padding: '2rem',
              width: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('comingSoonTitle', { defaultValue: 'Coming Soon' })}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('comingSoonDesc', { defaultValue: 'This feature is under construction.' })}
            </p>
            <Button
              variant="secondary"
              onClick={() => setShowComingSoon(false)}
              style={{ alignSelf: 'flex-end' }}
            >
              {t('ctaClose', { defaultValue: 'Close' })}
            </Button>
          </Card>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>
          {t('loading', { defaultValue: 'Loading...' })}
        </div>
      ) : builds.length === 0 ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('empty', { defaultValue: 'No builds yet.' })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {builds.map((build) => (
            <div
              key={build.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {build.name}
                  </span>
                  <StatusPill level={build.status === 'DONE' ? 'GOLD' : 'DEFAULT'}>
                    {build.status}
                  </StatusPill>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Epi: {build.metrics.episodes} · Sce: {build.metrics.scenes} · Sho:{' '}
                  {build.metrics.shots}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => (window.location.href = `/zh/studio/jobs`)}
              >
                {t('ctaOpenStudio')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
