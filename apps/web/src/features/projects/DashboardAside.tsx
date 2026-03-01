'use client';

import React from 'react';
import { RecentActivityPanel } from './RecentActivityPanel';
import { SystemStatusPanel } from './SystemStatusPanel';
import { Card } from '@/components/ui/Card';
import { useTranslations } from 'next-intl';

export function DashboardAside() {
  const t = useTranslations('Projects.aside');

  return (
    <>
      <RecentActivityPanel />
      <SystemStatusPanel />
      <Card style={{ padding: '1.25rem' }}>
        <h3
          style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {t('quickLinks')}
        </h3>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}
        >
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            → Documentation
          </a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            → Platform Walkthrough
          </a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            → Evidence Index
          </a>
        </div>
      </Card>
    </>
  );
}
