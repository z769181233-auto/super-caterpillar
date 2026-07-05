'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, VideoPromptDTO } from '@scu/shared-types';
import {
  generateStudioVideoPrompts,
  getStudioProductionState,
  getStudioVideoPrompts,
} from './api';
import { StudioLayout } from './StudioLayout';

interface StudioVideoPromptPageProps {
  locale: string;
  projectId: string;
  episodeId: string;
}

export function StudioVideoPromptPage({ locale, projectId, episodeId }: StudioVideoPromptPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [videoPrompts, setVideoPrompts] = useState<VideoPromptDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioVideoPrompts(projectId)])
      .then(([nextState, nextVideoPrompts]) => {
        if (!mounted) return;
        setState(nextState);
        setVideoPrompts(nextVideoPrompts);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const promptStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'video_prompt_ready') || null,
    [state]
  );
  const realVideoPrompts = videoPrompts.filter((prompt) => prompt.status !== 'missing');
  const visibleVideoPrompts = useMemo(() => {
    if (!episodeId || episodeId === 'episode-placeholder') return realVideoPrompts;
    const matching = realVideoPrompts.filter((prompt) => prompt.episodeId === episodeId);
    return matching.length > 0 ? matching : realVideoPrompts;
  }, [episodeId, realVideoPrompts]);
  const isDone = realVideoPrompts.length > 0;
  const metrics = {
    promptCount: String(realVideoPrompts.length),
    shotCoverage: promptStage?.evidence.find((item) => item.startsWith('shotCoverage:'))?.split(':')[1] || '未评估',
    storyboardBinding:
      promptStage?.evidence.find((item) => item.startsWith('storyboardBinding:'))?.split(':')[1] || '未评估',
    characterBinding:
      promptStage?.evidence.find((item) => item.startsWith('characterBinding:'))?.split(':')[1] || '未评估',
    locationBinding:
      promptStage?.evidence.find((item) => item.startsWith('locationBinding:'))?.split(':')[1] || '未评估',
    continuityCoverage:
      promptStage?.evidence.find((item) => item.startsWith('continuityCoverage:'))?.split(':')[1] || '未评估',
    qualityScore:
      promptStage?.evidence.find((item) => item.startsWith('quality_score:'))?.split(':')[1] || '未评估',
  };

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextVideoPrompts = await generateStudioVideoPrompts(projectId);
      const nextState = await getStudioProductionState(projectId);
      setVideoPrompts(nextVideoPrompts);
      setState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Studio VideoPrompt');
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
          Phase 2C：只生成 VideoPrompt 文本准备态，不创建 VideoJob
        </p>
        <div
          style={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>视频提示词 VideoPrompt</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 ShotScript、StoryboardAsset 文本绑定、CharacterBible 和 LocationBible 派生镜头级视频提示词，包括正向提示词、反向提示词、镜头语言、对白、声音和连续性约束。
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '999px',
              color: '#0f1115',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              minWidth: '158px',
              padding: '0.85rem 1.15rem',
            }}
          >
            {generating ? '生成中...' : isDone ? '重新生成视频提示词' : '生成视频提示词'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="视频提示词未生成"
            body={
              promptStage?.missingReason ||
              videoPrompts[0]?.missingReason ||
              '当前还没有 VideoPrompt。这里不会把 ShotScript 草案、StoryboardAsset 或旧视频任务伪装成正式视频提示词。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成镜头级 VideoPrompt 文本准备态。不会创建 VideoJob，不会调用视频模型，不会启动 worker，不会生成视频预览，也不能视为成片。"
        />

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            marginTop: '1rem',
          }}
        >
          <MetricCard label="Prompt 数量" value={metrics.promptCount} />
          <MetricCard label="Shot 覆盖率" value={metrics.shotCoverage} />
          <MetricCard label="Storyboard 绑定" value={metrics.storyboardBinding} />
          <MetricCard label="角色绑定" value={metrics.characterBinding} />
          <MetricCard label="场景绑定" value={metrics.locationBinding} />
          <MetricCard label="连续性覆盖" value={metrics.continuityCoverage} />
          <MetricCard label="质量分" value={metrics.qualityScore} />
        </div>

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {visibleVideoPrompts.length > 0 ? (
            visibleVideoPrompts.map((prompt) => (
              <VideoPromptCard key={prompt.id || prompt.shotId || 'video-prompt'} prompt={prompt} />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成视频提示词" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function VideoPromptCard({ prompt }: { prompt: VideoPromptDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        镜头 {prompt.shotNo ?? '--'} · {prompt.durationSec ?? '--'}s · {prompt.aspectRatio || '画幅待定'}
      </h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow label="VideoPrompt ID" value={prompt.id || '未生成'} />
        <InfoRow label="Shot ID" value={prompt.shotId || '未绑定'} />
        <InfoRow label="集 ID / 场 ID" value={`${prompt.episodeId || '--'} / ${prompt.sceneId || '--'}`} />
        <InfoRow label="场景资产" value={prompt.locationId || '未绑定 LocationBible'} />
        <InfoRow
          label="角色"
          value={prompt.characters.length > 0 ? prompt.characters.join('\n') : '未绑定 CharacterBible'}
        />
        <InfoRow label="正向视频提示词" value={prompt.prompt || '未生成'} />
        <InfoRow label="反向提示词" value={prompt.negativePrompt || '未生成'} />
        <InfoRow label="镜头语言" value={prompt.cameraLanguage || '未生成'} />
        <InfoRow label="对白提示" value={prompt.dialogueCue || '无对白'} />
        <InfoRow label="声音提示" value={prompt.soundCue || '未生成'} />
        <InfoRow label="光影提示" value={prompt.lightingCue || '未生成'} />
        <InfoRow label="运动提示" value={prompt.motionCue || '未生成'} />
        <InfoRow label="来源 ShotScript" value={prompt.sourceShotScriptId || '未绑定'} />
        <InfoRow label="来源 StoryboardAsset" value={prompt.sourceStoryboardAssetId || '未绑定'} />
        <InfoRow label="来源分镜提示词" value={prompt.sourceStoryboardPrompt || '未生成'} />
        <InfoRow
          label="连续性备注"
          value={prompt.continuityNotes.length > 0 ? prompt.continuityNotes.join('\n') : '未生成'}
        />
        <InfoRow label="协议版本" value={prompt.version || '未生成'} />
        <InfoRow label="阶段边界" value="VideoPrompt 只是文本准备态；未创建 VideoJob，未调用视频模型。" />
      </div>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '0.85rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</div>
      <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
    </div>
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
        padding: '0.85rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
