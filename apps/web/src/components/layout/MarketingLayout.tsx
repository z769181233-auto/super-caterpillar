import React, { ReactNode } from 'react';
import { Nav } from '@/app/[locale]/Nav';

interface MarketingLayoutProps {
    children: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'var(--bg-root)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* 
        Global TopBar 
        We reuse the existing Nav component which carries LanguageSwitcher & UserNav
      */}
            <Nav />

            {/* Main Landing Content Space */}
            <main
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                }}
            >
                {children}
            </main>

            {/* Footer can be managed within children or added directly here if uniform */}
        </div>
    );
}
