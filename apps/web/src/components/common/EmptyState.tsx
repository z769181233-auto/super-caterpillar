'use client';

import React from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

/**
 * Stage 22.0: 通用空态引导组件 (终极固化版)
 * 物理兜底：min-h-400 + pointer-events: auto
 */
export function EmptyState({ title, description, actionLabel, actionHref, icon }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center w-full p-8"
      style={{
        minHeight: '400px',
        pointerEvents: 'auto',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        className="glass-panel animate-fade-in max-w-md w-full p-12 text-center flex flex-col items-center gap-6"
        style={{ pointerEvents: 'auto' }}
      >
        {/* 动画图标容器 */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[hsla(var(--hsl-primary),0.2)] to-transparent flex items-center justify-center mb-2 animate-glow border border-[hsla(var(--hsl-primary),0.3)]">
          {icon || (
            <svg
              className="w-10 h-10 text-[hsl(var(--hsl-primary-glow))]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl text-gradient font-bold">{title}</h2>
          {description && (
            <p className="text-sm text-[hsl(var(--hsl-text-muted))] leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full mt-4" style={{ pointerEvents: 'auto' }}>
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className="btn btn-primary btn-lg w-full"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
              }}
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .flex {
          display: flex;
        }
        .flex-col {
          flex-direction: column;
        }
        .items-center {
          align-items: center;
        }
        .justify-center {
          justify-content: center;
        }
        .text-center {
          text-align: center;
        }
        .gap-3 {
          gap: 0.75rem;
        }
        .gap-6 {
          gap: 1.5rem;
        }
        .max-w-md {
          max-width: 28rem;
        }
        .w-full {
          width: 100%;
        }
        .p-12 {
          padding: 3rem;
        }
        .p-8 {
          padding: 2rem;
        }
        .space-y-3 > :not([hidden]) ~ :not([hidden]) {
          margin-top: 0.75rem;
        }
        .text-2xl {
          font-size: 1.5rem;
          line-height: 2rem;
        }
        .text-sm {
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .mt-4 {
          margin-top: 1rem;
        }
        .mb-2 {
          margin-bottom: 0.5rem;
        }
        .w-20 {
          width: 5rem;
        }
        .h-20 {
          height: 5rem;
        }
        .rounded-full {
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
}
