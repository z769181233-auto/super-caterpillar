'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui/EmptyState';

export function RecentActivityPanel() {
  const t = useTranslations('Projects.aside');

  return (
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
        {t('recentActivity')}
      </h3>
      <div style={{ padding: '1rem 0' }}>
        <EmptyState
          title=""
          description="No recent activity to show."
          icon={<span style={{ fontSize: '1.2rem' }}>⏳</span>}
        />
      </div>
    </Card>
  );
}
