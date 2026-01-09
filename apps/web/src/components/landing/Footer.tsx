import Link from 'next/link';
import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} Super Caterpillar Universe. All rights reserved.
        </div>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-white transition-colors">
            隐私政策
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            使用条款
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            联系我们
          </Link>
        </div>
      </div>
    </footer>
  );
}
