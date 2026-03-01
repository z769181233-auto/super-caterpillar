'use client';

import React from 'react';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';

export function ProjectDetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Area Skeleton */}
      <div
        style={{
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <SkeletonBlock width="40%" height="2rem" style={{ marginBottom: '0.5rem' }} />
            <SkeletonBlock width="60%" height="1rem" style={{ marginBottom: '1.5rem' }} />
            <SkeletonBlock width="80px" height="1.5rem" />
          </div>
          <SkeletonBlock width="120px" height="2.5rem" />
        </div>
      </div>

      {/* Quick Stats Grid Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <SkeletonBlock width="50%" height="0.75rem" />
            <SkeletonBlock width="30%" height="1.5rem" />
          </div>
        ))}
      </div>

      {/* Recent Builds Skeleton */}
      <div
        style={{
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <SkeletonBlock width="200px" height="1.5rem" style={{ marginBottom: '2rem' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="30%" height="1rem" style={{ marginBottom: '0.5rem' }} />
              <SkeletonBlock width="50%" height="0.75rem" />
            </div>
            <SkeletonBlock width="100px" height="2rem" />
          </div>
        </div>
      </div>
    </div>
  );
}
