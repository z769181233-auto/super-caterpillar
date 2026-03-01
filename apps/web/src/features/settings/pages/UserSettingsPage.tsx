'use client';

import React, { useEffect } from 'react';
import { PageShell } from '@/components/system/PageShell';
import { useRequestState } from '@/hooks/useRequestState';
import { UserSettingsSkeleton } from '../components/UserSettingsSkeleton';
import { ErrorState } from '@/components/system/ErrorState';
import { EmptyState } from '@/components/system/EmptyState';

export function UserSettingsPage() {
  // Mock user settings data
  const s = useRequestState<any>(null);

  const loadSettings = async () => {
    s.setLoading();
    try {
      // Simulated fetch
      await new Promise((r) => setTimeout(r, 1200));
      s.setSuccess({
        user: {
          name: 'Adam Artist',
          email: 'adam@super-caterpillar.com',
          avatarUrl: null,
        },
        notifications: {
          email: true,
          browser: false,
        },
        theme: 'dark',
        language: 'en',
      });
    } catch (err: any) {
      s.setError(err, 'SET-USR-' + Date.now().toString().slice(-6));
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (s.status === 'loading') {
    return <UserSettingsSkeleton />;
  }

  const d = s.data || {
    user: { name: '', email: '' },
    notifications: { email: false, browser: false },
    theme: 'dark'
  };

  return (
    <PageShell maxWidth="900px">
      {s.status === 'error' ? (
        <ErrorState error={s.error} traceId={s.traceId} onRetry={loadSettings} />
      ) : s.status === 'empty' ? (
        <EmptyState
          title="Settings Not Found"
          description="Could not locate your user profile preferences."
          onAction={loadSettings}
        />
      ) : (
        <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
          <header>
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: '0.5rem',
              }}
            >
              User Preferences
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Manage your account settings and notification preferences.
            </p>
          </header>

          {/* Profile Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2.5rem',
              padding: '2.5rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#000',
              }}
            >
              {d.user.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {d.user.name}
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>{d.user.email}</p>
            </div>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Edit Profile
            </button>
          </div>

          {/* Settings Lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            <section>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{ width: 8, height: 8, background: 'currentColor', borderRadius: '50%' }}
                />
                Notifications
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.25rem',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                  }}
                >
                  <span>Email Notifications</span>
                  <div
                    style={{
                      width: 48,
                      height: 26,
                      background: d.notifications.email ? '#4CAF50' : '#333',
                      borderRadius: '13px',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        background: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: 2,
                        left: d.notifications.email ? 24 : 2,
                        transition: 'all 0.2s',
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.25rem',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                  }}
                >
                  <span>Browser Push</span>
                  <div
                    style={{
                      width: 48,
                      height: 26,
                      background: d.notifications.browser ? '#4CAF50' : '#333',
                      borderRadius: '13px',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        background: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: 2,
                        left: d.notifications.browser ? 24 : 2,
                        transition: 'all 0.2s',
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{ width: 8, height: 8, background: 'currentColor', borderRadius: '50%' }}
                />
                Workspace
              </h3>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: '16px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>Interface Theme</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Currently using high-contrast {d.theme} mode
                  </div>
                </div>
                <select
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#222',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                >
                  <option>Dark</option>
                  <option>Light</option>
                  <option>System</option>
                </select>
              </div>
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}
