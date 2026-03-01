import React from 'react';
import { LandingPage } from '@/features/landing/LandingPage';
import { setRequestLocale } from 'next-intl/server';

export default function IndexPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <LandingPage />;
}
