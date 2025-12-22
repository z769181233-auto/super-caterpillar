'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { LandingContent } from '../content/types';

interface HeroSectionProps {
    content: LandingContent['hero'];
}

import { useRouter } from 'next/navigation';

export function HeroSection({ content }: HeroSectionProps) {
    const router = useRouter();
    const scrollToProcess = () => {
        const el = document.getElementById('flow');
        el?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section
            id="top"
            className="starfield relative flex flex-col items-center justify-center text-center px-6 min-h-[70vh] py-20 overflow-hidden text-white"
        >
            <div className="relative z-10 max-w-4xl w-full">
                {/* H1 Title */}
                <h1 className="animate-fade-in text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold mb-6 leading-[1.1] whitespace-pre-wrap drop-shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                    {content.title}
                </h1>

                {/* Subtitle */}
                <h2 className="animate-fade-in animation-delay-200 text-[clamp(1.2rem,3vw,1.8rem)] font-medium max-w-3xl mx-auto mb-6 text-muted-foreground whitespace-pre-wrap">
                    {content.subtitle}
                </h2>

                {/* Description */}
                <p className="animate-fade-in animation-delay-300 text-[clamp(0.9rem,2vw,1.1rem)] max-w-2xl mx-auto mb-12 text-muted-foreground/80 whitespace-pre-wrap">
                    {content.description}
                </p>

                {/* CTAs */}
                <div className="animate-fade-in animation-delay-400 flex flex-wrap gap-6 justify-center">
                    <Button
                        size="lg"
                        className="button-glow px-8 h-12 text-base md:text-lg rounded-full"
                        onClick={() => router.push('/studio')}
                    >
                        {content.ctaPrimary} &rarr;
                    </Button>
                    <Button
                        size="lg"
                        variant="glass"
                        className="px-8 h-12 text-base md:text-lg rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        onClick={scrollToProcess}
                    >
                        {content.ctaSecondary} &rarr;
                    </Button>
                </div>
            </div>
        </section>
    );
}

