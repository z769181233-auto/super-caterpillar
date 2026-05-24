'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import type { ProductionStateDTO } from '@scu/shared-types';
import { getStudioProductionState, StudioApiError } from './api';
import { StudioLayout } from './StudioLayout';
import {
  formatLegacySummary,
  formatSceneCandidateCoverage,
  formatShotScriptQualityGate,
  formatTextPipelineSummary,
  getDoneStages,
  getMissingOrBlockedStages,
  getRequiredEmptyStateLabels,
} from './studio-state-summary';

interface StudioOverviewPageProps {
  locale: string;
  projectId: string;
}

function card(children: React.ReactNode) {
  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-panel)',
        padding: '1.5rem',
      }}
    >
      {children}
    </section>
  );
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
        if (mounted) {
          setState(nextState);
          setError(null);
          setErrorDetail(null);
          setErrorStatus(null);
        }
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

  const doneStages = state ? getDoneStages(state) : [];
  const missingStages = state ? getMissingOrBlockedStages(state) : [];
  const requiredEmptyStates = state ? getRequiredEmptyStateLabels(state) : [];
  const importHref = `/${locale}/projects/${projectId}/import-novel`;
  const demoHref = `/${locale}/projects/studio-phase-1b-text-smoke/studio`;
  const hasStorySource = Boolean(state?.legacyDataSummary.hasStorySource || state?.legacyDataSummary.hasNovelSource);
  const stageByKey = (key: string) => state?.stages.find((stage) => stage.key === key);

  return (
    <StudioLayout
      locale={locale}
      projectId={projectId}
      state={state}
      stateError={error}
      onRetryState={() => setReloadKey((value) => value + 1)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-lg)',
            background: 'var(--bg-panel)',
            padding: '1.5rem',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>Studio v2 文本生产链路</p>
          <h1 style={{ margin: 0, fontSize: '2.25rem' }}>动漫视频制作工作台</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '48rem' }}>
            从小说或原创剧本开始，自动生成动漫制作资料。当前阶段只封板 StoryBible、EpisodePlan、DirectorScript 和 ShotScript，
            不生成分镜图、图片或视频。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
            <Link href={importHref} style={primaryButtonStyle()}>
              导入小说
            </Link>
            <button type="button" disabled style={disabledButtonStyle()} title="AI 原创剧本即将支持">
              AI 原创剧本 · 即将支持
            </button>
            <Link href={demoHref} style={secondaryButtonStyle()}>
              查看演示项目 / 使用演示数据
            </Link>
          </div>
        </section>

        {error &&
          card(
            <>
              <h2 style={{ marginTop: 0 }}>暂时无法读取制作状态</h2>
              <p style={{ color: 'var(--text-secondary)' }}>请确认 API 服务已启动，或刷新页面重试。</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <button type="button" onClick={() => setReloadKey((value) => value + 1)} style={{ padding: '0.7rem 1rem' }}>
                  Retry
                </button>
                <span style={{ color: 'var(--text-secondary)' }}>API base URL：/api</span>
                {errorStatus ? <span style={{ color: 'var(--text-secondary)' }}>HTTP status：{errorStatus}</span> : null}
              </div>
              <details style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                <summary>错误详情</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{errorDetail || error}</pre>
              </details>
            </>
          )}

        {state && !hasStorySource
          ? card(
              <>
                <h2 style={{ marginTop: 0 }}>还没有小说或剧本来源</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  请先导入小说，系统会生成 StoryBible、EpisodePlan、DirectorScript 和 ShotScript。
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
                  当前未生成任何视觉资产。Storyboard / Image / Video 仍未开始。
                </p>
              </>
            )
          : null}

        {state
          ? card(
              <>
                <h2 style={{ marginTop: 0 }}>制作流程</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <FlowCard label="StoryBible" status={stageByKey('story_bible_ready')?.status || 'missing'} />
                  <FlowCard label="EpisodePlan" status={stageByKey('episodes_ready')?.status || 'missing'} />
                  <FlowCard label="DirectorScript" status={stageByKey('director_script_ready')?.status || 'missing'} />
                  <FlowCard label="ShotScript" status={stageByKey('shot_script_ready')?.status || 'missing'} />
                  <FlowCard label="Storyboard" status="locked" detail="LOCKED / MISSING" />
                  <FlowCard label="Image" status="locked" detail="LOCKED / NOT STARTED" />
                  <FlowCard label="VideoPrompt" status="locked" detail="LOCKED / NOT STARTED" />
                  <FlowCard label="Video" status="locked" detail="LOCKED / NOT STARTED" />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                  ShotScript ready 后，storyboard_prompt 仍只是文本准备态，不生成图片；video_prompt 仍只是文本准备态，不调用视频生成；未创建 worker/job。
                </p>
              </>
            )
          : null}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>生产状态总览</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              当前阶段：<strong style={{ color: 'var(--text-primary)' }}>{state?.currentStage || '读取中'}</strong>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
              <div>
                <h3>已完成阶段</h3>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
                  {(doneStages.length ? doneStages.map((item) => item.label) : ['暂无']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>缺失 / 阻塞阶段</h3>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
                  {(missingStages.length ? missingStages.map((item) => `${item.label}：${item.missingReason || item.status}`) : ['暂无']).map(
                    (item) => (
                      <li key={item}>{item}</li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h3>下一步动作</h3>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
                  {(state?.nextActions?.length ? state.nextActions : ['等待生产状态']).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>空态确认</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              本轮不伪造结果：没有 StoryBible、EpisodePlan、DirectorScript、ShotScript 时必须显示未生成。
            </p>
            <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.2rem' }}>
              {(requiredEmptyStates.length ? requiredEmptyStates : ['状态读取中']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>文本生产链路封板</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Phase 1B-D 只验收 StoryBible → EpisodePlan → DirectorScript → ShotScript。ShotScript ready 不代表分镜、图片、视频或 worker job 已生成。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              {(state ? formatTextPipelineSummary(state) : ['状态读取中']).map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--text-secondary)',
                    padding: '0.75rem',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </>
        )}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>旧数据兼容摘要</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
              {(state ? formatLegacySummary(state) : ['状态读取中']).map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    padding: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </>
        )}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>小说分析质量门禁</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              这里只读展示 scene candidate 覆盖率；不足时会阻断 EpisodePlan / DirectorScript / ShotScript，避免把摘要伪装成正式视频剧本。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              {(state ? formatSceneCandidateCoverage(state) : ['状态读取中']).map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    padding: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </>
        )}

        {card(
          <>
            <h2 style={{ marginTop: 0 }}>镜头台本质量门禁</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              这里显示 ShotScript 写入前质量门槛。若不能生成镜头台本，原因会直接显示在这里，不需要只看 API 报错。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              {(state ? formatShotScriptQualityGate(state) : ['状态读取中']).map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-md)',
                    padding: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </StudioLayout>
  );
}

function primaryButtonStyle() {
  return {
    background: 'var(--text-primary)',
    border: '1px solid var(--text-primary)',
    borderRadius: 'var(--r-md)',
    color: 'var(--bg-surface)',
    fontWeight: 800,
    padding: '0.8rem 1rem',
    textDecoration: 'none',
  };
}

function secondaryButtonStyle() {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    padding: '0.8rem 1rem',
    textDecoration: 'none',
  };
}

function disabledButtonStyle() {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
    opacity: 0.7,
    padding: '0.8rem 1rem',
  };
}

function FlowCard({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const normalized = status === 'done' ? 'READY' : status === 'locked' ? detail || 'LOCKED' : status.toUpperCase();
  const isReady = normalized === 'READY';
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        background: isReady ? 'var(--bg-card)' : 'transparent',
        padding: '0.9rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</div>
      <strong>{normalized}</strong>
    </div>
  );
}
