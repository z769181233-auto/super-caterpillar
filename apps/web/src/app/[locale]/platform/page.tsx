'use client';

import React from 'react';
import { Button } from '@/components/_legacy/ui/Button';
import { useRouter } from 'next/navigation';

export default function PlatformPage() {
    const router = useRouter();
    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-4xl font-bold mb-6">开放平台</h1>
            <h2 className="text-xl text-muted-foreground mb-10">Open Platform Coming Soon</h2>
            <p className="text-muted-foreground/80 mb-10 max-w-lg">
                我们将开放 Engine Universe, Model Universe, Asset Universe 的底层能力，
                赋能开发者构建更强大的动漫工业应用。
            </p>
            <Button size="lg" className="button-glow px-8 h-12 rounded-full" onClick={() => router.push('/studio')}>
                进入 Studio &rarr;
            </Button>
        </main>
    );
}
