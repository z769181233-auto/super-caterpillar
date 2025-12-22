
import React from 'react';
import './landing.css';
import { landingZh } from './content/landing.zh';
import { landingEn } from './content/landing.en';
import { HeroSection } from './sections/HeroSection';
import { NotAToolSection } from './sections/NotAToolSection';
import { PersonaSection } from '@/components/_legacy/landing/sections/PersonaSection';
import { PipelineSection } from './sections/PipelineSection';
import { CapabilitiesSection } from '@/components/_legacy/landing/sections/CapabilitiesSection';
import { UniverseSection } from './sections/UniverseSection';
import { FinalCTASection } from './sections/FinalCTASection';
import { Footer } from './Footer';

interface LandingPageProps {
    lang: 'zh' | 'en';
}

export function LandingPage({ lang }: LandingPageProps) {
    const content = lang === 'en' ? landingEn : landingZh;

    return (
        <main className="min-h-screen bg-black text-white selection:bg-[var(--hsl-brand)] selection:text-black">
            <HeroSection content={content.hero} />
            <NotAToolSection content={content.notATool} />
            <UniverseSection content={content.threeSystems} />
            <PipelineSection content={content.productionFlow} />
            <CapabilitiesSection content={content.capabilities} />
            <PersonaSection content={content.solutionRoles} />
            <FinalCTASection content={content.footerCTA} />
            <Footer />
        </main>
    );
}
