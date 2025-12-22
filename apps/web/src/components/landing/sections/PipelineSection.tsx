
import React from 'react';
import { SectionHeader } from '../blocks/SectionHeader';
import { LandingContent } from '../content/types';

interface PipelineSectionProps {
    content: LandingContent['productionFlow'];
}

export function PipelineSection({ content }: PipelineSectionProps) {
    return (
        <section id="flow" className="py-16 lg:py-24 px-6 lg:px-8 bg-black/50">
            <SectionHeader title={content.title} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {content.steps.map((step, index) => {
                    // Extract the number (e.g., "01") from the title if consistent
                    const stepNum = index + 1;

                    return (
                        <div key={index} className="relative group">
                            {/* Visual Connector for Desktop (except last item) */}
                            {index < content.steps.length - 1 && (
                                <div className="hidden lg:block absolute top-[2.5rem] right-[-1.5rem] w-6 h-[2px] bg-white/10 z-0" />
                            )}

                            <div className="
                        relative z-10 h-full
                        bg-white/[0.02] border border-white/5 
                        rounded-[var(--radius-lg)] p-6
                        transition-all duration-300 hover:bg-white/[0.04]
                    ">
                                <div className="
                            flex items-center justify-center
                            w-12 h-12 rounded-full 
                            bg-[var(--hsl-brand)] text-black font-bold text-lg
                            mb-4 shadow-[0_0_15px_hsla(var(--hsl-brand),0.3)]
                        ">
                                    {stepNum}
                                </div>

                                <h3 className="text-lg font-bold mb-2 text-white">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    );
}
