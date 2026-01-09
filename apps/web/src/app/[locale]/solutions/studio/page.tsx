'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { useRouter } from 'next/navigation';

export default function SolutionStudioPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-6">动画工作室解决方案</h1>
      <ul className="text-muted-foreground mb-10 text-lg space-y-2">
        <li>• 用 AI 把动画生产标准化</li>
        <li>• 自动化管线管理</li>
        <li>• 降低人员管理成本</li>
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
