'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, ProductionStageDTO } from '@scu/shared-types';
import { getStudioProductionState, StudioApiError } from './api';
import { StudioLayout } from './StudioLayout';
import {
  getFirstTextPipelineBlocker,
  isTextPipelineReady,
} from './studio-state-summary';

interface StudioOverviewPageProps {
  locale: string;
  projectId: string;
}

const TEXT_STAGES = [
  { key: 'story_bible_ready', label: 'StoryBible' },
  { key: 'episodes_ready', label: 'EpisodePlan' },
  { key: 'director_script_ready', label: 'DirectorScript' },
  { key: 'shot_script_ready', label: 'ShotScript' },
] as const;

function getStage(state: ProductionStateDTO | null, key: string): ProductionStageDTO | null {
  return state?.stages.find((stage) => stage.key === key) || null;
}

function getEvidenceValue(stage: ProductionStageDTO | null, name: string): string | null {
  const prefix = `${name}:`;
  const line = stage?.evidence.find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length) : null;
}

function statusLabel(status: string | undefined): string {
  if (status === 'done') return 'READY';
  if (status === 'blocked') return 'BLOCKED';
  if (status === 'missing') return 'MISSING';
  if (status === 'failed') return 'FAILED';
  return status ? status.toUpperCase() : 'NOT STARTED';
}

function statusColor(status: string | undefined): string {
  if (status === 'done') return 'var(--accent)';
  if (status === 'blocked' || status === 'failed') return 'var(--hsl-error)';
  return 'var(--text-secondary)';
}

function getErrorCopy(status: number | null): { title: string; body: string; primaryAction: string } {
  if (status === 401) {
    return {
      title: '无法读取项目制作状态',
      body: '当前登录态已失效或尚未登录。请先登录后再回到 Studio。',
      primaryAction: '去登录',
    };
  }
  if (status === 403) {
    return {
      title: '无法读取项目制作状态',
      body: '当前账号可能没有访问该项目的权限，或登录态已失效。',
      primaryAction: '去登录',
    };
  }
  return {
    title: '无法读取项目制作状态',
    body: '可能是未登录、没有项目权限、API 服务未启动，或本地代理配置异常。',
    primaryAction: '去登录',
  };
}

function getNextAction(state: ProductionStateDTO | null): string {
  if (!state) return '先恢复制作状态读取，然后继续文本链路。';
  if (!state.legacyDataSummary.hasStorySource && !state.legacyDataSummary.hasNovelSource) {
    return '导入小说，作为 StoryBible、EpisodePlan、DirectorScript 和 ShotScript 的来源。';
  }
  const blocker = getFirstTextPipelineBlocker(state);
  if (!blocker) return '文本链路已完成。下一阶段只能先做视觉资产方案设计。';
  if (blocker.key === 'story_bible_ready') return '生成或修复 StoryBible。';
  if (blocker.key === 'episodes_ready') return '生成或修复第一集 EpisodePlan。';
  if (blocker.key === 'director_script_ready') return '生成或修复第一集 DirectorScript。';
  if (blocker.key === 'shot_script_ready') return '生成或修复第一集 ShotScript。';
  return blocker.nextAction || '处理当前阻断项。';
}

export function StudioOverviewPage({ locale, projectId }: StudioOverviewPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    getStudioProductionState(projectId)
      .then((nextState) => {
        if (!mounted) return;
        setState(nextState);
        setError(null);
        setErrorDetail(null);
        setErrorStatus(null);
      })
      .catch((err: Error) => {
        if (!mounted) return;
        setState(null);
        setError(err.message);
        setErrorDetail(err instanceof StudioApiError ? err.detail : err.message);
        setErrorStatus(err instanceof StudioApiError ? err.status : null);
      });

    return () => {
      mounted = false;
    };
  }, [projectId, reloadKey]);

  const importHref = `/${locale}/projects/${projectId}/import-novel`;
  const demoHref = `/${locale}/projects/studio-phase-1b-text-smoke/studio`;
  const loginHref = `/${locale}/login`;
  const projectHref = `/${locale}/projects/${projectId}`;
  const hasStorySource = Boolean(state?.legacyDataSummary.hasStorySource || state?.legacyDataSummary.hasNovelSource);
  const textReady = state ? isTextPipelineReady(state) : false;
  const shotCount = getEvidenceValue(getStage(state, 'shot_script_ready'), 'Project.metadata.animationStudio.shotScripts') || '0';
  const storyboardStage = getStage(state, 'storyboard_ready');
  const storyboardAssetCount =
    getEvidenceValue(storyboardStage, 'Project.metadata.animationStudio.storyboardAssets') || '0';
  const errorCopy = getErrorCopy(errorStatus);
  const nextAction = getNextAction(state);
  const visualSummary = useMemo(
    () => [
      {
        label: 'StoryboardAsset',
        status: storyboardStage?.status === 'done' ? 'READY / TEXT' : 'LOCKED / MISSING',
        body:
          storyboardStage?.status === 'done'
            ? `文本分镜资产 ${storyboardAssetCount} 个；assetUrl 为空，不生成图片。`
            : '未生成 StoryboardAsset 文本绑定。',
      },
      { label: 'Image', status: 'LOCKED / NOT STARTED', body: '没有图片生成入口。' },
      { label: 'Video', status: 'LOCKED / NOT STARTED', body: '没有视频生成入口。' },
    ],
    [storyboardAssetCount, storyboardStage?.status]
  );

  return (
    <StudioLayout
      locale={locale}
      projectId={projectId}
      state={state}
      stateError={error}
      onRetryState={() => setReloadKey((value) => value + 1)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <section style={heroStyle()}>
          <div>
            <p style={eyebrowStyle()}>Studio v2 · 文本生产链路</p>
            <h1 style={{ fontSize: '2.6rem', margin: 0 }}>动漫视频制作工作台</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '54rem' }}>
              从小说或原创剧本开始，自动生成动漫制作资料。当前阶段只封板 StoryBible、EpisodePlan、DirectorScript 和 ShotScript，
              不生成分镜图、图片或视频。
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link href={importHref} style={primaryButtonStyle()}>
              导入小说
            </Link>
            <button type="button" disabled style={disabledButtonStyle()} title="AI 原创剧本即将支持">
              AI 原创剧本 · 即将支持
            </button>
            <Link href={demoHref} style={secondaryButtonStyle()}>
              使用演示项目 / 查看演示数据
            </Link>
          </div>
        </section>

        {error ? (
          <section style={cardStyle('var(--bg-panel)')}>
            <p style={eyebrowStyle()}>需要处理</p>
            <h2 style={{ margin: 0 }}>{errorCopy.title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{errorCopy.body}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link href={loginHref} style={primaryButtonStyle()}>
                {errorCopy.primaryAction}
              </Link>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} style={buttonStyle()}>
                刷新页面
              </button>
              <Link href={projectHref} style={secondaryButtonStyle()}>
                返回项目页
              </Link>
            </div>
            <details style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              <summary>技术详情</summary>
              <dl style={{ display: 'grid', gap: '0.35rem', marginBottom: 0 }}>
                <DetailRow label="HTTP status" value={errorStatus ? String(errorStatus) : '无响应'} />
                <DetailRow label="API base URL" value="/api" />
                <DetailRow label="projectId" value={projectId} />
                <DetailRow label="error message" value={errorDetail || error} />
              </dl>
            </details>
          </section>
        ) : null}

        {state && !hasStorySource ? (
          <section style={cardStyle('var(--bg-panel)')}>
            <p style={eyebrowStyle()}>开始制作</p>
            <h2 style={{ margin: 0 }}>还没有小说或剧本来源</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              请先导入小说。系统会自动分析并生成故事圣经、剧集规划、导演剧本和镜头台本。
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link href={importHref} style={primaryButtonStyle()}>
                导入小说
              </Link>
              <button type="button" disabled style={disabledButtonStyle()}>
                AI 原创剧本 · 即将支持
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
              Storyboard / Image / Video 尚未开始，不会生成图片或视频。
            </p>
          </section>
        ) : null}

        <section style={cardStyle('var(--bg-panel)')}>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <p style={eyebrowStyle()}>制作进度</p>
              <h2 style={{ margin: 0 }}>{textReady ? '文本链路已完成' : '文本链路进行中'}</h2>
            </div>
            <div style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>下一步：{nextAction}</div>
          </div>
          <div style={flowGridStyle()}>
            {TEXT_STAGES.map((item) => {
              const stage = getStage(state, item.key);
              const quality = getEvidenceValue(stage, 'quality_score');
              const isShot = item.key === 'shot_script_ready';
              return (
                <FlowCard
                  key={item.key}
                  label={item.label}
                  status={statusLabel(stage?.status)}
                  statusColor={statusColor(stage?.status)}
                  detail={isShot ? `shot count: ${shotCount}` : quality ? `quality score: ${quality}` : 'quality score: --'}
                />
              );
            })}
            {visualSummary.map((item) => (
              <FlowCard key={item.label} label={item.label} status={item.status} statusColor="var(--text-secondary)" detail={item.body} />
            ))}
          </div>
          <div style={noticeStyle()}>
            ShotScript ready 只代表镜头台本文本 ready。StoryboardAsset ready 只代表文本分镜绑定 ready；storyboard_prompt 不生成图片，video_prompt 不调用视频生成。
          </div>
        </section>
      </div>
    </StudioLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.75rem' }}>
      <dt>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word' }}>{value}</dd>
    </div>
  );
}

function FlowCard({ label, status, statusColor, detail }: { label: string; status: string; statusColor: string; detail: string }) {
  return (
    <article style={flowCardStyle()}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{label}</div>
      <strong style={{ color: statusColor }}>{status}</strong>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.45 }}>{detail}</div>
    </article>
  );
}

function heroStyle(): React.CSSProperties {
  return {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '2rem',
  };
}

function cardStyle(background: string): React.CSSProperties {
  return {
    background,
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    padding: '1.5rem',
  };
}

function eyebrowStyle(): React.CSSProperties {
  return {
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 800,
    letterSpacing: 0,
    margin: '0 0 0.45rem',
    textTransform: 'uppercase',
  };
}

function primaryButtonStyle(): React.CSSProperties {
  return {
    background: 'var(--text-primary)',
    border: '1px solid var(--text-primary)',
    borderRadius: 'var(--r-md)',
    color: 'var(--bg-surface)',
    fontWeight: 800,
    padding: '0.85rem 1.1rem',
    textDecoration: 'none',
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    padding: '0.85rem 1.1rem',
    textDecoration: 'none',
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0.85rem 1.1rem',
  };
}

function disabledButtonStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
    opacity: 0.7,
    padding: '0.85rem 1.1rem',
  };
}

function flowGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.85rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    marginTop: '1.25rem',
  };
}

function flowCardStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    display: 'grid',
    gap: '0.35rem',
    minHeight: '112px',
    padding: '1rem',
  };
}

function noticeStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    marginTop: '1rem',
    padding: '1rem',
  };
}
