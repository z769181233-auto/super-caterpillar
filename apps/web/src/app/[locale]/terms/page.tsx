'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-6">使用条款</h1>
      <p className="text-muted-foreground mb-10">Terms of Service Placeholder</p>
      <Button
        size="lg"
        className="button-glow px-8 h-12 rounded-full"
        onClick={() => router.push('/')}
      >
        回到首页 &rarr;
      </Button>
    </main>
  );
}
