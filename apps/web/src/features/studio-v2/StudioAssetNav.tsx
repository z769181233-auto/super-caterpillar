'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildStudioV2Nav, type StudioV2NavItem } from './studio-navigation';

interface StudioAssetNavProps {
  locale: string;
  projectId: string;
}

export function StudioAssetNav({ locale, projectId }: StudioAssetNavProps) {
  const pathname = usePathname();
  const items = buildStudioV2Nav(locale, projectId);
  const flowItems = items.filter((item) => item.group === 'flow');
  const assetItems = items.filter((item) => item.group === 'assets');

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-label="Studio v2 制作流程">
      <Link
        href={`/${locale}/projects/${projectId}`}
        style={{
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          padding: '0.65rem 0.85rem',
        }}
      >
        &larr; 返回旧项目页
      </Link>
      <NavGroup title="制作流程" items={flowItems} pathname={pathname} />
      <NavGroup title="资产库" items={assetItems} pathname={pathname} compact />
    </nav>
  );
}

function NavGroup({
  title,
  items,
  pathname,
  compact = false,
}: {
  title: string;
  items: StudioV2NavItem[];
  pathname: string;
  compact?: boolean;
}) {
  return (
    <section style={{ display: 'grid', gap: '0.4rem' }}>
      <div
        style={{
          color: 'var(--text-tertiary)',
          fontSize: '0.75rem',
          fontWeight: 800,
          letterSpacing: 0,
          padding: '0 0.85rem',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-disabled={item.locked ? true : undefined}
            style={{
              background: active ? 'var(--bg-card)' : 'transparent',
              border: active ? '1px solid var(--border-subtle)' : '1px solid transparent',
              borderRadius: 'var(--r-md)',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active ? 800 : 600,
              padding: compact ? '0.55rem 0.85rem' : '0.72rem 0.85rem',
              textDecoration: 'none',
            }}
          >
            {item.label}
            {item.locked ? (
              <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                未开始，不开放生成
              </span>
            ) : null}
          </Link>
        );
      })}
    </section>
  );
}
