'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { getAuthErrorMessageKey, getAuthModeMeta } from './auth-mode-meta';

interface AuthShellProps {
  mode: 'login' | 'register';
}

export function AuthShell({ mode }: AuthShellProps) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const searchParams = useSearchParams();

  const resolveErrorMessage = (errorCode: string | null | undefined) =>
    t(getAuthErrorMessageKey(errorCode));

  const [errorMsg] = useState<string | null>(() =>
    searchParams.has('error') ? resolveErrorMessage(searchParams.get('error')) : null
  );
  const [successMsg] = useState<string | null>(() =>
    searchParams.get('registered') === '1' ? t('registerSuccess') : null
  );

  const isLogin = mode === 'login';
  const title = isLogin ? t('titleLogin') : t('titleRegister');
  const submitText = isLogin ? t('submitLogin') : t('submitRegister');
  const authModeMeta = getAuthModeMeta({
    mode,
    locale,
    fromParam: searchParams.get('from'),
  });

  return (
    <Card
      style={{
        padding: '2.25rem 2rem',
        width: '100%',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}
        >
          {title}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('footerTerms')} · {t('footerPrivacy')}
        </p>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Alert variant="warning">{errorMsg}</Alert>
        </div>
      )}

      {successMsg && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Alert variant="info">
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>{successMsg}</div>
            </div>
          </Alert>
        </div>
      )}

      <form
        action={authModeMeta.formAction}
        method="post"
        style={{ width: '100%' }}
      >
        <FormField label={t('emailLabel')}>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="engineer@super-caterpillar.com"
            defaultValue={searchParams.get('email') || ''}
          />
        </FormField>

        <FormField label={t('passwordLabel')}>
          <Input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="••••••••"
          />
        </FormField>

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {t('submitHint')}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            style={{
              width: '100%',
              minHeight: '3.5rem',
              background: 'linear-gradient(135deg, var(--gold-hover), var(--gold))',
              borderColor: 'var(--gold-hover)',
              color: 'var(--on-gold)',
              boxShadow: '0 12px 28px rgba(200, 164, 93, 0.28)',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {submitText}
          </Button>

          <div
            style={{
              textAlign: 'center',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
            }}
          >
            {t(authModeMeta.promptKey)}{' '}
            <Link
              href={authModeMeta.switchHref}
              style={{
                color: 'var(--gold)',
                fontWeight: 600,
                textDecoration: 'underline',
                textUnderlineOffset: '0.18rem',
              }}
            >
              {t(authModeMeta.actionKey)}
            </Link>
          </div>
        </div>
      </form>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          href={`/${locale}`}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textDecoration: 'underline',
          }}
        >
          &larr; {t('backToLanding')}
        </Link>
      </div>
    </Card>
  );
}
