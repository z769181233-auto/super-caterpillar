
import React from 'react';
import { SectionHeader } from '@/components/landing/blocks/SectionHeader';
import { FeatureCard } from '@/components/landing/blocks/FeatureCard';
import { LandingContent } from '@/components/landing/content/types';

interface CapabilitiesSectionProps {
    content: LandingContent['capabilities'];
}

export function CapabilitiesSection({ content }: CapabilitiesSectionProps) {
    return (
        <section id="capabilities" className="py-16 lg:py-24 px-6 lg:px-8 bg-black/30">
            <SectionHeader title={content.title} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {content.cards.map((card, index) => (
                    <FeatureCard
                        key={index}
                        title={card.title}
                        desc={card.desc}
                        link={(card as any).link}
                        className="md:min-h-[200px]"
                    />
                ))}
            </div>
        </section>
    );
}
