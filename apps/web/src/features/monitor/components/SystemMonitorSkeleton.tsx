'use client';

import React from 'react';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';

export function SystemMonitorSkeleton() {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBlock width="200px" height="2rem" />
        <SkeletonBlock width="150px" height="1.5rem" />
      </div>

      {/* Stats Grid Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem' }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              padding: '1.5rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
            }}
          >
            <SkeletonBlock width="60px" height="0.75rem" style={{ marginBottom: '1rem' }} />
            <SkeletonBlock width="100px" height="2rem" />
          </div>
        ))}
      </div>

      {/* Detailed Stats Section Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <div
          style={{ padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
        >
          <SkeletonBlock width="120px" height="1.25rem" style={{ marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SkeletonBlock width="100%" height="1rem" />
            <SkeletonBlock width="100%" height="1rem" />
            <SkeletonBlock width="100%" height="1rem" />
          </div>
        </div>
        <div
          style={{ padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
        >
          <SkeletonBlock width="120px" height="1.25rem" style={{ marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <SkeletonBlock width="100%" height="1rem" />
            <SkeletonBlock width="100%" height="1rem" />
            <SkeletonBlock width="100%" height="1rem" />
          </div>
        </div>
      </div>

      {/* Queue Statistics Skeleton */}
      <div
        style={{ padding: '2rem', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
      >
        <SkeletonBlock width="150px" height="1.25rem" style={{ marginBottom: '1.5rem' }} />
        <div style={{ display: 'flex', gap: '2rem' }}>
          <SkeletonBlock width="200px" height="4rem" />
          <SkeletonBlock width="200px" height="4rem" />
        </div>
      </div>
    </div>
  );
}
