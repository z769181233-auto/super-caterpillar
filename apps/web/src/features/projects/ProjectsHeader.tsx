'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getProjectsCreateHref } from './project-create-flow';

interface ProjectsHeaderProps {
  onCreateClick: () => void;
}

export function ProjectsHeader({ onCreateClick }: ProjectsHeaderProps) {
  const t = useTranslations('Projects');
  const locale = useLocale();
  const createHref = getProjectsCreateHref(locale);

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
        <Link
          href={createHref}
          onClick={(event) => {
            event.preventDefault();
            onCreateClick();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--r-md)',
            background: 'var(--gold)',
            color: 'var(--on-gold)',
            border: '1px solid var(--gold)',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {t('newProject')}
        </Link>
      </div>
    </div>
  );
}
