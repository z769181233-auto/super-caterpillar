'use client';

import React from 'react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { HeroSection } from './HeroSection';
import { FeatureGrid } from './FeatureGrid';
import { ProofStrip } from './ProofStrip';
import { SecondaryLinks } from './SecondaryLinks';

export function LandingPage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <ProofStrip />
      <FeatureGrid />
      <SecondaryLinks />
    </MarketingLayout>
  );
}
