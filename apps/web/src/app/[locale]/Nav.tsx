'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { UserNav } from '@/components/UserNav';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function Nav() {
  const t = useTranslations('Index');
  const pathname = usePathname();
  const router = useRouter();

  // Determine if we are on the homepage (root or root locale path)
  const isHome = pathname === '/' || /^\/(en|zh)$/.test(pathname);

  // Studio route handler: hide global nav to allow StudioShell to take over the full header
  if (pathname.includes('/builds/')) {
    return null;
  }

  return (
    <header
      className="glass-panel flex-between"
      style={{
        borderRadius: 0,
        borderTop: 0,
        borderLeft: 0,
        borderRight: 0,
        padding: '1rem 2rem',
        marginBottom: '2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" className="flex-center" style={{ gap: '1rem', textDecoration: 'none' }}>
        <div
          className="animate-spin-slow"
          style={{
            width: 32,
            height: 32,
            background:
              'linear-gradient(135deg, hsl(var(--hsl-primary)), hsla(var(--hsl-brand), 0.2))',
            borderRadius: '50%',
            boxShadow: '0 0 15px hsla(var(--hsl-primary), 0.4)',
          }}
        ></div>
        <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>
          {t('navTitle')}
        </h1>
      </Link>

      <div className="flex-center" style={{ gap: '1.5rem' }}>
        {isHome && (
          <nav
            style={{
              display: 'flex',
              gap: '2rem',
              fontSize: '0.9rem',
              color: 'hsl(var(--hsl-text-muted))',
              fontWeight: 500,
              alignItems: 'center',
            }}
          >
            <a href="#flow" className="hover:text-white transition-colors">
              {t('nav.process')}
            </a>
            <a href="#capabilities" className="hover:text-white transition-colors">
              {t('nav.features')}
            </a>
            <Link href="/platform" className="hover:text-white transition-colors">
              {t('nav.platform')}
            </Link>
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push('/projects')}
              className="ml-4"
            >
              {t('nav.enterStudio')}
            </Button>
          </nav>
        )}
        <UserNav />
        <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }}></div>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
