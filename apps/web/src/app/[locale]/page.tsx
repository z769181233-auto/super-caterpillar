import React from 'react';
import { LandingPage } from '@/features/landing/LandingPage';
import { setRequestLocale } from 'next-intl/server';

export default async function IndexPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <LandingPage />;
}
