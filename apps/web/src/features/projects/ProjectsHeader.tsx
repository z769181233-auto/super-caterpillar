'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

interface ProjectsHeaderProps {
  onCreateClick: () => void;
}

export function ProjectsHeader({ onCreateClick }: ProjectsHeaderProps) {
  const t = useTranslations('Projects');

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}
        >
          {t('title')}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('subtitle')}</p>
      </div>

      <div>
        <Button variant="primary" onClick={onCreateClick}>
          {t('newProject')}
        </Button>
      </div>
    </div>
  );
}
