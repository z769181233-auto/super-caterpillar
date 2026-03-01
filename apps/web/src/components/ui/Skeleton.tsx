import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--r-md)',
  className = '',
  style,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--bg-card)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      <style>
        {`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .skeleton-shimmer::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.04) 50%,
              transparent 100%
            );
            animation: shimmer 1.5s infinite linear;
          }
        `}
      </style>
      <div className="skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
