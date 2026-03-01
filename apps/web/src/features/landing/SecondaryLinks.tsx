'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export function SecondaryLinks() {
  const t = useTranslations('Landing.footer');

  return (
    <footer
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 2rem',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <a
          href="#"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}
        >
          {t('docs')}
        </a>
        <a
          href="#"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}
        >
          {t('walkthrough')}
        </a>
        <a
          href="#"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}
        >
          {t('evidence')}
        </a>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        © {new Date().getFullYear()} Super Caterpillar. All rights reserved.
      </p>
    </footer>
  );
}
