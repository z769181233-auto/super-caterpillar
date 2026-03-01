'use client';

import React from 'react';

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  variant?: 'rect' | 'circle' | 'text';
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonBlock({
  width = '100%',
  height = '1rem',
  variant = 'rect',
  className = '',
  style: propStyle = {},
}: SkeletonBlockProps) {
  const style: React.CSSProperties = {
    width,
    height,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? '4px' : '8px',
    overflow: 'hidden',
    position: 'relative',
  };

  return (
    <div className={`skeleton-shimmer ${className}`} style={{ ...style, ...propStyle }}>
      <style jsx>{`
        .skeleton-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.03), transparent);
          animation: shimmer 2s infinite;
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
