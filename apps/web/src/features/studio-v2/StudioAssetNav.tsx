'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildStudioV2Nav } from './studio-navigation';

interface StudioAssetNavProps {
  locale: string;
  projectId: string;
}

export function StudioAssetNav({ locale, projectId }: StudioAssetNavProps) {
  const pathname = usePathname();
  const items = buildStudioV2Nav(locale, projectId);

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} aria-label="Studio v2">
      <Link
        href={`/${locale}/projects/${projectId}`}
        style={{
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          padding: '0.75rem 1rem',
        }}
      >
        &larr; 返回旧项目页
      </Link>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              background: active ? 'var(--bg-card)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active ? 700 : 500,
              padding: '0.75rem 1rem',
              borderRadius: 'var(--r-md)',
              border: active ? '1px solid var(--border-subtle)' : '1px solid transparent',
              textDecoration: 'none',
            }}
          >
            {item.label}
            {item.locked ? (
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                未开始，不开放生成
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
