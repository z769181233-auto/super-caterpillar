'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      // Simple strategy: replace core locale segment if present or simplistic push
      // Note: In a real next-intl setup, we'd use usePathname and replace the locale prefix
      // For this scaffold, likely default handling via middleware
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh(); // Soft refresh to apply cookie
    });
  };

  return (
    <select
      defaultValue={locale}
      onChange={onSelectChange}
      disabled={isPending}
      style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        border: '1px solid #ccc',
        background: '#fff',
        marginLeft: '1rem',
      }}
    >
      <option value="en">English</option>
      <option value="zh">中文</option>
    </select>
  );
}
