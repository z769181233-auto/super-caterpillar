'use client';

import React, { useEffect, useState } from 'react';
import type { ProductionStateDTO, StorySourceCompatibilityDTO } from '@scu/shared-types';
import { getStorySourceCompatibility, getStudioProductionState } from './api';
import { StudioLayout } from './StudioLayout';

interface StudioSourcePageProps {
  locale: string;
  projectId: string;
}

function getSourceType(state: ProductionStateDTO | null) {
  if (!state) return '读取中';
  if (state.legacyDataSummary.hasStorySource) return '标准 StorySource';
  if (state.legacyDataSummary.hasNovelSource) return '小说导入（旧 NovelSource/Novel 兼容）';
  return '未知';
}

export function StudioSourcePage({ locale, projectId }: StudioSourcePageProps) {
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

  const legacy = state?.legacyDataSummary;

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
          只读 StorySource 状态，不改变旧小说导入逻辑
        </p>
        <h1 style={{ marginTop: 0 }}>小说原文 / StorySource</h1>
        {error && <p style={{ color: 'var(--hsl-error)' }}>{error}</p>}
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '220px minmax(0, 1fr)',
            gap: '1rem',
            color: 'var(--text-secondary)',
          }}
        >
          <dt>来源类型</dt>
          <dd>{getSourceType(state)}</dd>
          <dt>小说标题</dt>
          <dd>{legacy?.novelTitle || '--'}</dd>
          <dt>文件名</dt>
          <dd>{legacy?.novelFileName || '--'}</dd>
          <dt>章节数量</dt>
          <dd>{legacy?.novelChapterCount ?? '--'}</dd>
          <dt>是否已有 StorySource</dt>
          <dd>{legacy?.hasStorySource ? '是' : '否'}</dd>
          <dt>兼容映射</dt>
          <dd>
            {!legacy
              ? '读取中'
              : compatibility?.canMapFromLegacy
                ? '可由旧 NovelSource 兼容映射'
                : legacy.hasStorySource
                  ? '已存在标准 StorySource'
                  : '尚无可映射来源'}
          </dd>
          <dt>兼容状态</dt>
          <dd>{compatibility?.compatibilityStatus || '读取中'}</dd>
          <dt>映射预览</dt>
          <dd>
            {compatibility
              ? `${compatibility.mappingPreview.sourceTable || '--'} / ${compatibility.mappingPreview.sourceId || '--'}`
              : '读取中'}
          </dd>
          <dt>缺失字段</dt>
          <dd>
            {compatibility?.mappingPreview.missingFields.length
              ? compatibility.mappingPreview.missingFields.join('、')
              : compatibility
                ? '无阻断缺失'
                : '读取中'}
          </dd>
          <dt>下一步</dt>
          <dd>{compatibility?.nextAction || '读取中'}</dd>
        </dl>
        {compatibility?.warnings.length ? (
          <div
            style={{
              marginTop: '1.5rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-md)',
              padding: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>兼容映射风险</strong>
            <ul style={{ paddingLeft: '1.2rem' }}>
              {compatibility.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </StudioLayout>
  );
}
