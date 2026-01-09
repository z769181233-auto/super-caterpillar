import React from 'react';
import { SectionHeader } from '../blocks/SectionHeader';
import { FeatureCard } from '../blocks/FeatureCard';
import { LandingContent } from '../content/types';

interface NotAToolSectionProps {
  content: LandingContent['notATool'];
}

export function NotAToolSection({ content }: NotAToolSectionProps) {
  return (
    <section id="why" className="py-16 lg:py-24 px-6 lg:px-8 text-center bg-black/50">
      <SectionHeader title={content.title} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {content.cards.map((card, index) => (
          <FeatureCard
            key={index}
            title={card.title}
            desc={card.desc}
            icon={['🏗️', '✅', '💰'][index]} // Fixed icons as per theme, could also be passed via props if needed
            className="h-full"
          />
        ))}
      </div>
    </section>
  );
}
