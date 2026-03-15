'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { getSafeRedirect } from '@/lib/nav/safeRedirect';

interface AuthShellProps {
  mode: 'login' | 'register';
}

export function AuthShell({ mode }: AuthShellProps) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLogin = mode === 'login';
  const title = isLogin ? t('titleLogin') : t('titleRegister');
  const submitText = isLogin ? t('submitLogin') : t('submitRegister');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.data?.message || result.error?.message || t('errorInvalid'));
      }

      // Success: accessToken is already set in httpOnly cookie by the backend
      // Read fallback route if provided by middleware
      const fromParam = searchParams.get('from');
      const safePath = getSafeRedirect(fromParam, locale, `/${locale}/projects`);

      // Using replace to prevent back button from returning to login form
      router.replace(safePath);
    } catch (err: any) {
      setErrorMsg(err.message || t('errorInvalid'));
      setLoading(false);
    }
  };

  return (
    <Card
      style={{
        padding: '3rem 2.5rem',
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

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <FormField label={t('emailLabel')}>
          <Input
            type="email"
            required
            placeholder="engineer@super-caterpillar.com"
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <FormField label={t('passwordLabel')}>
          <Input
            type="password"
            required
            placeholder="••••••••"
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          style={{ width: '100%', marginTop: '1rem' }}
          disabled={loading}
        >
          {loading ? t('loading') : submitText}
        </Button>
      </form>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          onClick={() => router.push('/')}
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
        </button>
      </div>
    </Card>
  );
}
