'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      // Persistent locale tracking
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

      // Extract current path pieces and conditionally rewrite locale segment
      const currentSegments = pathname.split('/');
      let newPath = pathname;
      if (['zh', 'en', 'vi'].includes(currentSegments[1])) {
        currentSegments[1] = nextLocale;
        newPath = currentSegments.join('/');
      } else {
        newPath = `/${nextLocale}${pathname}`;
      }

      // Preserve native query parameters & hashes to satisfy requirement
      const searchParams = window.location.search;
      const hash = window.location.hash;

      router.replace(`${newPath}${searchParams}${hash}`);
    });
  };

  return (
    <select
      defaultValue={locale}
      onChange={onSelectChange}
      disabled={isPending}
      className="glass-panel"
      style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--glass-border)',
        background: 'transparent',
        color: 'var(--text-main)',
        fontSize: '0.85rem',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <option style={{ color: 'var(--on-gold)' }} value="en">EN</option>
      <option style={{ color: 'var(--on-gold)' }} value="zh">ZH</option>
      <option style={{ color: 'var(--on-gold)' }} value="vi">VI</option>
    </select>
  );
}
