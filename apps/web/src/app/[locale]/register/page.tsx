import React from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthShell } from '@/features/auth/AuthShell';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return {
    title: t('titleRegister'),
  };
}

export default function RegisterPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  return (
    <AuthLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <AuthShell mode="register" />
      </Suspense>
    </AuthLayout>
  );
}
