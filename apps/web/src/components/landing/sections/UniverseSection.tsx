
import React from 'react';
import { SectionHeader } from '../blocks/SectionHeader';
import { LandingContent } from '../content/types';

interface UniverseSectionProps {
    content: LandingContent['threeSystems'];
}

export function UniverseSection({ content }: UniverseSectionProps) {
    return (
        <section id="universe" className="py-16 lg:py-24 px-6 lg:px-8 bg-black/50 text-center">
            <SectionHeader title={content.title} subtitle={content.subtitle} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {content.cards.map((card, index) => (
                    <div key={index} className="glass-panel relative overflow-hidden p-10 text-center group">
                        {/* Highlight Bar for Engine (First Item) */}
                        {index === 0 && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--hsl-brand)]" />
                        )}

                        <div className="text-5xl mb-6 opacity-80 group-hover:scale-110 transition-transform duration-300">
                            {index === 0 ? '🧠' : (index === 1 ? '📦' : '📂')}
                        </div>

                        <h3 className="text-2xl font-bold mb-4 text-white">
                            {card.title}
                        </h3>
                        <p className="text-base text-muted-foreground leading-relaxed">
                            {card.desc}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
