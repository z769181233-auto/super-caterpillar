'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { useRouter } from 'next/navigation';

export default function SolutionCreatorPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-6">创作者解决方案</h1>
      <ul className="text-muted-foreground mb-10 text-lg space-y-2">
        <li>• 把故事，变成真正能持续更新的动画作品</li>
        <li>• 低成本验证 IP 潜力</li>
        <li>• 一个人就是一支队伍</li>
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
