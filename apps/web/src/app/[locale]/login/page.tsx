import React from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthShell } from '@/features/auth/AuthShell';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return {
    title: t('titleLogin'),
  };
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthShell mode="login" />
    </AuthLayout>
  );
}
