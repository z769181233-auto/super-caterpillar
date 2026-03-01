import React, { ReactNode } from 'react';

interface ProjectDetailLayoutProps {
  header?: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
}

export function ProjectDetailLayout({ header, sidebar, main, aside }: ProjectDetailLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        {header && <header>{header}</header>}

        <div
          style={{
            display: 'flex',
            gap: '2rem',
            alignItems: 'flex-start',
            flex: 1,
            flexWrap: 'wrap',
          }}
        >
          {/* Left Sidebar (Navigator) */}
          <aside style={{ flex: '0 0 220px' }}>
            <div
              style={{
                position: 'sticky',
                top: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {sidebar}
            </div>
          </aside>

          {/* Center Main Content */}
          <main
            style={{
              flex: '2 1 600px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
            }}
          >
            {main}
          </main>

          {/* Right Aside (Status & Audit) */}
          {aside && (
            <aside style={{ flex: '1 1 300px', minWidth: '300px', maxWidth: '350px' }}>
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
