'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/_legacy/ui/Button';
import { userApi } from '@/lib/apiClient';
import { UserDTO } from '@/types/dto';

export function UserNav() {
  const t = useTranslations('Common');
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData as UserDTO);
    } catch (e: unknown) {
      // Not logged in or error
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      {!user ? (
        <>
          <a
            href="/login"
            style={{
              fontSize: '0.9rem',
              color: 'hsl(var(--hsl-text-muted))',
              transition: 'color 0.2s',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            className="hover:text-white"
          >
            {t('login')}
          </a>

          <Button
            size="sm"
            variant="primary"
            onClick={() => (window.location.href = '/studio')}
            style={{ borderRadius: '2rem', padding: '0.5rem 1.2rem' }}
          >
            {t('enterWorkbench')}
          </Button>
        </>
      ) : (
        <div className="flex-center" style={{ gap: '1rem' }}>
          {/* User Avatar Placeholder */}
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt="User"
              width={32}
              height={32}
              style={{ borderRadius: '50%', border: '1px solid var(--glass-border)' }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'hsl(var(--hsl-primary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}

          <a
            href="/projects"
            style={{
              fontSize: '0.9rem',
              color: 'hsl(var(--hsl-text-main))',
              textDecoration: 'none',
              fontWeight: 500,
            }}
            className="hover:text-primary transition-colors"
          >
            {t('enterWorkbench')}
          </a>
        </div>
      )}
    </div>
  );
}
