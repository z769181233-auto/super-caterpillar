import React, { ReactNode } from 'react';

interface DashboardLayoutProps {
  header: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
}

export function DashboardLayout({ header, main, aside }: DashboardLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 
        This layout assumes the global top navigation (Nav.tsx with logo, user setting, and language switcher) 
        sits outside and above this container, providing the consistent Global TopBar.
      */}

      <div
        style={{
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '2rem 2rem 4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          flex: 1,
        }}
      >
        <header>{header}</header>

        <div
          style={{
            display: 'flex',
            gap: '2rem',
            alignItems: 'flex-start',
            flex: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* Main content area (Grid) */}
          <main style={{ flex: '2 1 600px', minWidth: 0 }}>{main}</main>

          {/* Aside properties */}
          {aside && (
            <aside style={{ flex: '1 1 300px', minWidth: '300px', maxWidth: '400px' }}>
              <div
                style={{
                  position: 'sticky',
                  top: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                {aside}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
