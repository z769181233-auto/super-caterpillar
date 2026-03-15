'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export function PrimaryCTA() {
  const t = useTranslations('Landing');
  const router = useRouter();

  // In PLAN-5.1, we will enhance this to check auth state.
  // We initialize a route pushing to projects directly as the baseline.
  // This satisfies PLAN-5.0 requirements for now.
  const handlePrimaryClick = () => {
    // Currently relying on auth middleware to redirect to login if unauthenticated
    router.push('/projects');
  };

  const handleSecondaryClick = () => {
    router.push('/projects');
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <Button size="lg" variant="primary" onClick={handlePrimaryClick}>
        {t('ctaPrimary')}
      </Button>
      <Button size="lg" variant="secondary" onClick={handleSecondaryClick}>
        {t('ctaSecondary')}
      </Button>
    </div>
  );
}
