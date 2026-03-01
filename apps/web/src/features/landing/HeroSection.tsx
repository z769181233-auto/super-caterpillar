'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export function HeroSection() {
  const t = useTranslations('Landing');
  const router = useRouter();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8rem 2rem 4rem',
        textAlign: 'center',
        // Hero background restriction: strictly use --bg-root / --bg-surface gradient
        background: 'radial-gradient(ellipse at top, var(--bg-surface) 0%, var(--bg-root) 100%)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          maxWidth: '900px',
          lineHeight: 1.1,
          marginBottom: '1.5rem',
        }}
      >
        {t('title')}
      </h1>
      <p
        style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          marginBottom: '3rem',
          lineHeight: 1.6,
        }}
      >
        {t('subtitle')}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button size="lg" variant="primary" onClick={() => router.push('/projects')}>
          {t('ctaPrimary')}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => router.push('/projects')}>
          {t('ctaSecondary')}
        </Button>
      </div>
    </section>
  );
}
