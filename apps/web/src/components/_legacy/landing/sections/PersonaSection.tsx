'use client';

import React from 'react';
import { SectionHeader } from '@/components/landing/blocks/SectionHeader';
import { LandingContent } from '@/components/landing/content/types';

interface PersonaSectionProps {
  content: LandingContent['solutionRoles'];
}

import { useRouter } from 'next/navigation';

export function PersonaSection({ content }: PersonaSectionProps) {
  const router = useRouter();

  const handleClick = (link?: string) => {
    if (link === 'overview') router.push('/solutions/creator');
    else if (link === 'pipeline') router.push('/solutions/studio');
    else if (link === 'assets') router.push('/solutions/enterprise');
    else {
      const el = document.getElementById('contact');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="solutions" className="py-16 lg:py-24 px-6 lg:px-8 bg-black/30">
      <SectionHeader title={content.title} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {content.cards.map((card, index) => (
          <div
            key={index}
            className="
                        group relative overflow-hidden
                        bg-gradient-to-br from-white/[0.03] to-white/[0.01]
                        border border-white/5 hover:border-white/10
                        rounded-[var(--radius-lg)] p-8 text-center
                        cursor-pointer transition-all duration-300 hover:bg-white/[0.05]
                    "
            onClick={() => handleClick((card as any).link)}
          >
            <h3 className="text-xl font-bold mb-2 text-white group-hover:text-[var(--hsl-brand)] transition-colors">
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 min-h-[3rem]">{card.desc}</p>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--hsl-brand)]">
              {card.action}
              <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
