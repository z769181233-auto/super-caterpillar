'use client';

import React, { useEffect, useState } from 'react';
import type { ProductionStateDTO, StorySourceCompatibilityDTO } from '@scu/shared-types';
import { getStorySourceCompatibility, getStudioProductionState } from './api';
import { StudioLayout } from './StudioLayout';

interface StudioAuditPageProps {
  locale: string;
  projectId: string;
}

export function StudioAuditPage({ locale, projectId }: StudioAuditPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [compatibility, setCompatibility] = useState<StorySourceCompatibilityDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStorySourceCompatibility(projectId)])
      .then(([nextState, nextCompatibility]) => {
        if (!mounted) return;
        setState(nextState);
        setCompatibility(nextCompatibility);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const checks = [
    {
      label: '故事来源',
      status: compatibility?.hasCanonicalStorySource
        ? '已存在标准 StorySource'
        : compatibility?.canMapFromLegacy
          ? '可由旧小说来源兼容映射'
          : '缺失',
    },
    {
      label: '故事圣经',
      status: state?.stages.find((stage) => stage.key === 'story_bible_ready')?.missingReason || '读取中',
    },
    {
      label: '角色资产',
      status: state?.stages.find((stage) => stage.key === 'characters_ready')?.missingReason || '读取中',
    },
    {
      label: '场景资产',
      status: state?.stages.find((stage) => stage.key === 'locations_ready')?.missingReason || '读取中',
    },
    {
      label: '镜头台本',
      status: state?.stages.find((stage) => stage.key === 'shot_script_ready')?.missingReason || '读取中',
    },
    {
      label: '分镜资产',
      status: state?.stages.find((stage) => stage.key === 'storyboard_ready')?.missingReason || '读取中',
    },
  ];

  return (
    <StudioLayout locale={locale} projectId={projectId} state={state}>
      <section
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--bg-panel)',
          padding: '1.5rem',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Phase 1B 只读审计，不生成、不迁移、不写库
        </p>
        <h1 style={{ marginTop: 0 }}>动漫制作 Studio 只读审计</h1>
        {error && <p style={{ color: 'var(--hsl-error)' }}>{error}</p>}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {checks.map((check) => (
            <div
              key={check.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px minmax(0, 1fr)',
                gap: '1rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--r-md)',
                padding: '1rem',
              }}
            >
              <strong>{check.label}</strong>
              <span style={{ color: 'var(--text-secondary)' }}>{check.status}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>审计结论：</strong>
          本页只说明当前资产缺口。没有 StoryBible、CharacterBible、LocationBible、ShotScript 或
          StoryboardAsset 时，不显示为已完成。
        </div>
      </section>
    </StudioLayout>
  );
}
