'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { useRouter } from 'next/navigation';

export default function SolutionEnterprisePage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-6">企业 / IP 方解决方案</h1>
      <ul className="text-muted-foreground mb-10 text-lg space-y-2">
        <li>• 资产可控、可审计</li>
        <li>• 版权与合规保障</li>
        <li>• 规模化生产能力</li>
      </ul>
      <Button
        size="lg"
        className="button-glow px-8 h-12 rounded-full"
        onClick={() => router.push('/studio')}
      >
        进入 Studio &rarr;
      </Button>
    </main>
  );
}
