'use client';

import React from 'react';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';

export function JobMonitorSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar Skeleton (Filters) */}
      <div
        style={{
          width: '280px',
          borderRight: '1px solid var(--border-subtle)',
          background: 'rgba(255,255,255,0.02)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        <SkeletonBlock width="120px" height="1.5rem" />
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <SkeletonBlock width="80px" height="0.75rem" style={{ marginBottom: '0.5rem' }} />
            <SkeletonBlock width="100%" height="2.5rem" />
          </div>
        ))}
        <SkeletonBlock width="100%" height="2.5rem" style={{ marginTop: 'auto' }} />
      </div>

      {/* Main Content Skeleton */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Stats Bar Skeleton */}
        <div
          style={{
            height: '80px',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
          }}
        >
          <SkeletonBlock width="150px" height="1rem" />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <SkeletonBlock width="80px" height="2rem" />
            <SkeletonBlock width="80px" height="2rem" />
            <SkeletonBlock width="80px" height="2rem" />
          </div>
        </div>

        {/* Table Header Skeleton */}
        <div
          style={{
            padding: '1.5rem 1.5rem 0.5rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <SkeletonBlock width="100px" height="1rem" />
            <SkeletonBlock width="120px" height="1rem" />
            <SkeletonBlock width="80px" height="1rem" />
          </div>
        </div>

        {/* Table Body Skeleton */}
        <div style={{ flex: 1, padding: '0 1.5rem', overflow: 'hidden' }}>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '60px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                gap: '1.5rem',
              }}
            >
              <SkeletonBlock width="24px" height="24px" />
              <SkeletonBlock width="120px" height="1rem" />
              <SkeletonBlock width="80px" height="1rem" />
              <SkeletonBlock width="100px" height="1.5rem" />
              <div style={{ flex: 1 }} />
              <SkeletonBlock width="150px" height="1rem" />
              <SkeletonBlock width="40px" height="24px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
