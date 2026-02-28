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
            // Mocked authentication process
            await new Promise(res => setTimeout(res, 800));

            // Simulate 10% chance of random network failure for demonstration
            if (Math.random() > 0.9) {
                throw new Error(t('errorNetwork'));
            }

            // We set a dummy cookie to pass the middleware check
            document.cookie = `accessToken=mock_token_123; path=/; max-age=3600; samesite=lax`;

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
                border: '1px solid var(--border-subtle)'
            }}
        >
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <h1
                    style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem'
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
                    />
                </FormField>

                <FormField label={t('passwordLabel')}>
                    <Input
                        type="password"
                        required
                        placeholder="••••••••"
                        disabled={loading}
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
                        textDecoration: 'underline'
                    }}
                >
                    &larr; {t('backToLanding')}
                </button>
            </div>
        </Card>
    );
}
