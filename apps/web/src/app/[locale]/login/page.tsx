import React from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthShell } from '@/features/auth/AuthShell';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return {
    title: t('titleLogin'),
  };
}

export default async function LoginPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <AuthLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <AuthShell mode="login" />
      </Suspense>
    </AuthLayout>
  );
}
