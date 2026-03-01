'use client';

import React from 'react';
import { SkeletonBlock } from '@/components/system/SkeletonBlock';

export function StudioShellSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Studio Header Skeleton */}
      <div
        style={{
          height: '60px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          gap: '1rem',
        }}
      >
        <SkeletonBlock width="40px" height="40px" variant="circle" />
        <SkeletonBlock width="200px" height="1.5rem" />
        <div style={{ flex: 1 }} />
        <SkeletonBlock width="100px" height="2rem" />
        <SkeletonBlock width="32px" height="32px" variant="circle" />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar Skeleton (Shots List) */}
        <div
          style={{
            width: '300px',
            borderRight: '1px solid var(--border-subtle)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <SkeletonBlock width="100%" height="2.5rem" style={{ marginBottom: '1rem' }} />
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <SkeletonBlock width="40px" height="40px" />
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="80%" height="0.75rem" />
                <SkeletonBlock width="40%" height="0.5rem" style={{ marginTop: '0.5rem' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Main Content (Preview + Timeline) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            }}
          >
            <SkeletonBlock width="80%" height="70%" />
          </div>
          {/* Timeline Skeleton */}
          <div
            style={{
              height: '240px',
              borderTop: '1px solid var(--border-subtle)',
              padding: '1rem',
            }}
          >
            <SkeletonBlock width="150px" height="1rem" style={{ marginBottom: '1rem' }} />
            <SkeletonBlock width="100%" height="100px" />
          </div>
        </div>

        {/* Right Panel Skeleton (Inspector) */}
        <div
          style={{
            width: '320px',
            borderLeft: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}
        >
          <div>
            <SkeletonBlock width="100px" height="1rem" style={{ marginBottom: '1rem' }} />
            <SkeletonBlock width="100%" height="150px" />
          </div>
          <div>
            <SkeletonBlock width="120px" height="1rem" style={{ marginBottom: '1rem' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[...Array(6)].map((_, i) => (
                <SkeletonBlock key={i} width="60px" height="1.5rem" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
