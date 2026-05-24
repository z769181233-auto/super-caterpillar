'use client';

import React, { useEffect, useState } from 'react';
import type { ProductionStateDTO } from '@scu/shared-types';
import { getStudioProductionState } from './api';
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

  useEffect(() => {
    let mounted = true;
    getStudioProductionState(projectId)
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const doneStages = state ? getDoneStages(state) : [];
  const missingStages = state ? getMissingOrBlockedStages(state) : [];
  const requiredEmptyStates = state ? getRequiredEmptyStateLabels(state) : [];

  return (
    <StudioLayout locale={locale} projectId={projectId} state={state}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
            Studio v2 只读骨架，不替换旧制作链路
          </p>
          <h1 style={{ margin: 0, fontSize: '2.25rem' }}>动漫制作 Studio</h1>
        </header>

        {error &&
          card(
            <>
              <h2 style={{ marginTop: 0 }}>生产状态读取失败</h2>
              <p style={{ color: 'var(--hsl-error)' }}>{error}</p>
            </>
          )}

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
