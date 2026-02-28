import React, { ReactNode } from 'react';
import { Nav } from '@/app/[locale]/Nav';

interface AuthLayoutProps {
    children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Nav />
            <main
                style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2rem',
                }}
            >
                <div style={{ width: '100%', maxWidth: '440px' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
