'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { LandingContent } from '../content/types';

interface FinalCTASectionProps {
  content: LandingContent['footerCTA'];
}

import { useRouter } from 'next/navigation';

export function FinalCTASection({ content }: FinalCTASectionProps) {
  const router = useRouter();
  return (
    <section id="contact" className="py-24 px-6 lg:px-8 text-center">
      <div
        className="
            max-w-4xl mx-auto
            bg-gradient-to-b from-transparent to-[hsla(var(--hsl-brand),0.05)]
            border border-[var(--glass-border)]
            rounded-[var(--radius-lg)]
            p-12 lg:p-20
        "
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-10 text-white">{content.title}</h2>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Button
            size="lg"
            className="button-glow px-10 h-14 text-lg rounded-full"
            onClick={() => router.push('/studio')}
          >
            {content.primary} &rarr;
          </Button>
          <Button
            size="lg"
            variant="glass"
            className="px-10 h-14 text-lg rounded-full bg-white/5 border-white/10 hover:bg-white/10"
          >
            {content.secondary} &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
