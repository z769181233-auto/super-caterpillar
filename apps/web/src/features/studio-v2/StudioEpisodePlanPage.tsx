'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { EpisodePlanDTO, ProductionStateDTO } from '@scu/shared-types';
import {
  generateStudioEpisodePlans,
  getStudioEpisodePlans,
  getStudioProductionState,
} from './api';
import { formatStudioGenerationError } from './studio-generation-blockers';
import { StudioLayout } from './StudioLayout';

interface StudioEpisodePlanPageProps {
  locale: string;
  projectId: string;
}

export function StudioEpisodePlanPage({ locale, projectId }: StudioEpisodePlanPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [episodePlans, setEpisodePlans] = useState<EpisodePlanDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioEpisodePlans(projectId)])
      .then(([nextState, nextEpisodePlans]) => {
        if (!mounted) return;
        setState(nextState);
        setEpisodePlans(nextEpisodePlans);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const episodeStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'episodes_ready') || null,
    [state]
  );
  const realEpisodePlans = episodePlans.filter((episodePlan) => episodePlan.status === 'done');
  const isDone = realEpisodePlans.length > 0;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextEpisodePlans = await generateStudioEpisodePlans(projectId);
      const nextState = await getStudioProductionState(projectId);
      setEpisodePlans(nextEpisodePlans);
      setState(nextState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Studio EpisodePlan';
      setError(formatStudioGenerationError(message, '剧集规划'));
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
          Phase 2D：只生成 EpisodePlan，不接导演剧本/镜头台本/分镜/视频
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
            <h1 style={{ margin: 0 }}>剧集规划 EpisodePlan</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 StoryBible、角色资产、场景资产、小说章节和旧 Episode 中生成每集的剧情目标、情绪曲线、爽点、结尾钩子和出场资产绑定。
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
              minWidth: '148px',
              padding: '0.85rem 1.15rem',
            }}
          >
            {generating ? '生成中...' : isDone ? '重新生成剧集规划' : '生成剧集规划'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="剧集规划未生成"
            body={
              episodeStage?.missingReason ||
              episodePlans[0]?.missingReason ||
              '当前还没有 EpisodePlan。这里不会把旧 Episode、章节摘要或场景列表伪装成正式剧集规划。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成结构化剧集规划。导演剧本、镜头台本、分镜图、视频提示词和镜头视频仍未生成，后续 Phase 继续补齐。"
        />

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {realEpisodePlans.length > 0 ? (
            realEpisodePlans.map((episodePlan) => (
              <EpisodePlanCard
                key={episodePlan.id || `${episodePlan.episodeNo}-${episodePlan.title}`}
                episodePlan={episodePlan}
              />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成剧集规划" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function EpisodePlanCard({ episodePlan }: { episodePlan: EpisodePlanDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        第 {episodePlan.episodeNo} 集 · {episodePlan.title}
      </h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow
          label="预计时长"
          value={episodePlan.durationSec ? `${Math.round(episodePlan.durationSec / 60)} 分钟` : '未生成'}
        />
        <InfoRow label="剧情目标" value={episodePlan.plotGoal || '未生成'} />
        <InfoRow
          label="情绪曲线"
          value={episodePlan.emotionCurve.length > 0 ? episodePlan.emotionCurve.join(' → ') : '未生成'}
        />
        <InfoRow
          label="爽点"
          value={episodePlan.coolPoints.length > 0 ? episodePlan.coolPoints.join('\n') : '未生成'}
        />
        <InfoRow label="结尾钩子" value={episodePlan.hook || '未生成'} />
        <InfoRow
          label="出场角色"
          value={
            episodePlan.appearingCharacterNames.length > 0
              ? episodePlan.appearingCharacterNames.join('、')
              : '未绑定角色资产'
          }
        />
        <InfoRow
          label="出现场景"
          value={
            episodePlan.appearingLocationNames.length > 0
              ? episodePlan.appearingLocationNames.join('、')
              : '未绑定场景资产'
          }
        />
        <InfoRow label="生产状态" value={episodePlan.productionStatus || '未生成'} />
        <InfoRow
          label="来源证据"
          value={episodePlan.sourceEvidence.length > 0 ? episodePlan.sourceEvidence.join('\n') : '未生成'}
        />
        <InfoRow label="协议版本" value={episodePlan.version || '未生成'} />
      </div>
    </article>
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
