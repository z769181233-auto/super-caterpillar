'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, StoryBibleDTO } from '@scu/shared-types';
import {
  generateStudioStoryBible,
  getStudioProductionState,
  getStudioStoryBible,
} from './api';
import { StudioLayout } from './StudioLayout';

interface StudioStoryBiblePageProps {
  locale: string;
  projectId: string;
}

export function StudioStoryBiblePage({ locale, projectId }: StudioStoryBiblePageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [storyBible, setStoryBible] = useState<StoryBibleDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioStoryBible(projectId)])
      .then(([nextState, nextStoryBible]) => {
        if (!mounted) return;
        setState(nextState);
        setStoryBible(nextStoryBible);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const storyBibleStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'story_bible_ready') || null,
    [state]
  );
  const isDone = storyBible?.status === 'done';

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextStoryBible = await generateStudioStoryBible(projectId);
      const nextState = await getStudioProductionState(projectId);
      setStoryBible(nextStoryBible);
      setState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Studio StoryBible');
    } finally {
      setGenerating(false);
    }
  }

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
          Phase 2A：只生成第一个真实结构化输出，不接图片/视频
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>故事圣经 StoryBible</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 StorySource 或旧 NovelSource 兼容读取故事材料，生成项目级世界观、主线冲突、情感线、视觉风格和改编策略。
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              border: 'none',
              borderRadius: '999px',
              background: 'var(--accent)',
              color: '#0f1115',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              minWidth: '148px',
              padding: '0.85rem 1.15rem',
            }}
          >
            {generating ? '生成中...' : isDone ? '重新生成故事圣经' : '生成故事圣经'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="故事圣经未生成"
            body={
              storyBibleStage?.missingReason ||
              storyBible?.missingReason ||
              '当前还没有 StoryBible。这里不会把小说摘要、旧章节或旧场景伪装成故事圣经。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成 StoryBible。CharacterBible、LocationBible、EpisodePlan、DirectorScript、ShotScript、StoryboardAsset 仍未生成，不能视为角色设定、场景设定、视频剧本或分镜完成。"
        />

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          <InfoRow label="生成状态" value={storyBible?.status || '读取中'} />
          <InfoRow label="项目标题" value={storyBible?.title || '未生成'} />
          <InfoRow label="类型" value={storyBible?.genre || '未生成'} />
          <InfoRow label="世界观" value={storyBible?.worldview || '未生成'} />
          <InfoRow label="主线冲突" value={storyBible?.mainConflict || '未生成'} />
          <InfoRow label="情感线" value={storyBible?.emotionalArc || '未生成'} />
          <InfoRow label="角色关系" value={storyBible?.characterRelationship || '未生成'} />
          <InfoRow
            label="长线伏笔"
            value={
              storyBible?.longTermForeshadowing?.length
                ? storyBible.longTermForeshadowing.join('\n')
                : '未生成'
            }
          />
          <InfoRow label="视觉风格" value={storyBible?.visualStyle || '未生成'} />
          <InfoRow label="目标平台" value={storyBible?.targetPlatform || '未生成'} />
          <InfoRow label="改编策略" value={storyBible?.adaptationStrategy || '未生成'} />
          <InfoRow label="观众钩子" value={storyBible?.audienceHook || '未生成'} />
          <InfoRow label="来源摘要" value={storyBible?.sourceSummary || '未生成'} />
          <InfoRow
            label="来源证据"
            value={storyBible?.sourceEvidence?.length ? storyBible.sourceEvidence.join('\n') : '未生成'}
          />
          <InfoRow label="生成时间" value={storyBible?.generatedAt || '未生成'} />
          <InfoRow label="协议版本" value={storyBible?.version || '未生成'} />
        </div>
      </section>
    </StudioLayout>
  );
}

function Callout({ tone, title, body }: { tone: 'error' | 'warn' | 'info'; title: string; body: string }) {
  const color =
    tone === 'error' ? 'var(--hsl-error)' : tone === 'warn' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        marginTop: '1rem',
        padding: '1rem',
      }}
    >
      <strong style={{ color }}>{title}</strong>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>{body}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
