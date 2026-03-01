'use client';

import React from 'react';

interface PageShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PageShell({
  children,
  header,
  footer,
  maxWidth = '1200px',
  className = '',
  style: propStyle = {},
}: PageShellProps) {
  return (
    <div
      className={`page-shell animate-fade-in ${className}`}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', ...propStyle }}
    >
      {header && <header className="page-header">{header}</header>}

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          margin: '0 auto',
          padding: 'var(--space-8) var(--space-4)',
        }}
      >
        {children}
      </main>

      {footer && <footer className="page-footer">{footer}</footer>}

      <style jsx>{`
        .page-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(var(--bg-root-rgb), 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
        }
      `}</style>
    </div>
  );
}
