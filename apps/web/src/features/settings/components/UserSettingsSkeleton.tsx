'use client';

import React from 'react';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';

export function UserSettingsSkeleton() {
  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '3rem',
      }}
    >
      {/* Header Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <SkeletonBlock width="250px" height="2.5rem" />
        <SkeletonBlock width="400px" height="1.25rem" />
      </div>

      {/* Profile Section Skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          padding: '2rem',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
        }}
      >
        <SkeletonBlock width="80px" height="80px" style={{ borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SkeletonBlock width="200px" height="1.5rem" />
          <SkeletonBlock width="300px" height="1rem" />
        </div>
      </div>

      {/* Settings Groups Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SkeletonBlock width="120px" height="1.25rem" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonBlock width="180px" height="1rem" />
                <SkeletonBlock width="60px" height="1.5rem" style={{ borderRadius: '12px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonBlock width="180px" height="1rem" />
                <SkeletonBlock width="60px" height="1.5rem" style={{ borderRadius: '12px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
