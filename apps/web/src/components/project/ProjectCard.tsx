'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';


interface ProjectCardProps {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  status?: 'READY' | 'RUNNING' | 'ERROR' | 'DONE';
  stats?: {
    seasonsCount?: number;
    scenesCount?: number;
    shotsCount?: number;
  };
  targetModule?: string | null;
  hasVideo?: boolean;
}

export function ProjectCard({ id, name, description, createdAt, status = 'READY', stats, targetModule, hasVideo }: ProjectCardProps) {
  const t = useTranslations('Projects');

  const statusConfig = {
    READY: { color: 'hsl(var(--hsl-text-muted))', label: t('status.READY') },
    RUNNING: { color: 'hsl(var(--hsl-primary))', label: t('status.RUNNING') },
    ERROR: { color: 'hsl(var(--hsl-error))', label: t('status.ERROR') },
    DONE: { color: 'hsl(var(--hsl-success))', label: t('status.DONE') },
  };

  const statusInfo = statusConfig[status] || statusConfig.READY;

  // Time formatting logic
  const updatedTime = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - updatedTime.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo = '';
  if (diffDays > 0) {
    timeAgo = t('time.daysAgo', { days: diffDays });
  } else if (diffHours > 0) {
    timeAgo = t('time.hoursAgo', { hours: diffHours });
  } else {
    timeAgo = t('time.justNow');
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Link
        href={targetModule ? `/projects/${id}?module=${targetModule}` : `/projects/${id}`}
        style={{ display: 'block', height: '100%' }}
      >
        <div
          className="glass-panel"
          style={{
            height: '240px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s var(--ease-spring)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'hsla(var(--hsl-primary), 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--glass-border)';
          }}
        >
          {/* Glow effect background */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle at center, hsla(var(--hsl-primary), 0.05) 0%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: 0
          }}></div>

          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusInfo.color,
                marginTop: '0.4rem',
                boxShadow: status === 'RUNNING' ? `0 0 8px ${statusInfo.color}` : 'none'
              }}></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.125rem',
                    color: 'hsl(var(--hsl-text-main))',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: hasVideo ? '70%' : '100%'
                  }}>
                    {name}
                  </h3>
                  {/* Video Indicator - Only visible if hasVideo is true */}
                  {hasVideo && (
                    <div style={{
                      fontSize: '0.75rem',
                      background: 'linear-gradient(135deg, hsl(var(--hsl-brand)), hsl(var(--hsl-secondary)))',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      boxShadow: '0 2px 8px hsla(var(--hsl-brand), 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>🎬</span>
                      <span>Watch</span>
                    </div>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>
                  {timeAgo}
                </p>
              </div>
            </div>

            {/* Description */}
            {description && (
              <p style={{
                fontSize: '0.875rem',
                color: 'hsl(var(--hsl-text-muted))',
                lineHeight: 1.5,
                opacity: 0.8,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginBottom: 'auto'
              }}>
                {description}
              </p>
            )}

            {/* Footer / Stats */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>{t('stats.seasons')}</div>
                  <div style={{ fontWeight: 600 }}>{stats?.seasonsCount ?? '-'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>{t('stats.scenes')}</div>
                  <div style={{ fontWeight: 600 }}>{stats?.scenesCount ?? '-'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>{t('stats.shots')}</div>
                  <div style={{ fontWeight: 600 }}>{stats?.shotsCount ?? '-'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--hsl-primary))', fontWeight: 500 }}>
                  {t('openStudio')} &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Absolute click target for Video if needed, but for now card click -> studio is default. 
          User said "Click directly enter play page". 
          I should intercept click on the badge or make a separate button.
      */}
      {hasVideo && (
        <Link
          href={`/projects/${id}/video`}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 10,
            cursor: 'pointer'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Transparent overlay on badge is hard, let's just use the badge area or a dedicated button.
                 Actually, reusing the badge defined above inside the Link is cleaner.
             */}
        </Link>
      )}
    </div>
  );
}
