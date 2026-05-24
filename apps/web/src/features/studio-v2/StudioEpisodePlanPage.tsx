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
  const realEpisodePlans = episodePlans.filter((episodePlan) => episodePlan.status === 'ready');
  const blockedEpisodePlans = episodePlans.filter((episodePlan) => episodePlan.status === 'blocked');
  const isReady = realEpisodePlans.length > 0;

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
          Phase 1B-B：只生成第一集 EpisodePlan，不接镜头台本/分镜/图片/视频/worker
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
              从 ready StoryBible 生成第一集剧情结构：开端、中段、结尾、关键场次、角色、地点、证据绑定和质量评分。
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
            {generating ? '生成中...' : isReady ? '重新生成第一集规划' : '生成第一集规划'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isReady && (
          <Callout
            tone={blockedEpisodePlans.length > 0 ? 'error' : 'warn'}
            title={blockedEpisodePlans.length > 0 ? '剧集规划质量不足' : '剧集规划未生成'}
            body={
              blockedEpisodePlans[0]?.blockers?.length
                ? blockedEpisodePlans[0].blockers.join('；')
                : blockedEpisodePlans[0]?.missingReasons?.length
                  ? blockedEpisodePlans[0].missingReasons.join('；')
                  : episodeStage?.missingReason ||
                    episodePlans[0]?.missingReason ||
                    '当前还没有 EpisodePlan。这里不会把旧 Episode、章节摘要或场景列表伪装成正式剧集规划。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成第一集 EpisodePlan。DirectorScript 需单独触发；ShotScript、分镜图、图片、视频和 worker 均不会在本页启动。"
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
          value={
            episodePlan.duration_target_sec || episodePlan.durationSec
              ? `${Math.round((episodePlan.duration_target_sec || episodePlan.durationSec || 0) / 60)} 分钟`
              : '未生成'
          }
        />
        <InfoRow label="episode_id" value={episodePlan.episode_id || episodePlan.episodeId || '未生成'} />
        <InfoRow label="story_bible_id" value={episodePlan.story_bible_id || '未绑定'} />
        <InfoRow label="episode_no" value={String(episodePlan.episode_no || episodePlan.episodeNo || '未生成')} />
        <InfoRow label="状态" value={episodePlan.status || '未生成'} />
        <InfoRow label="质量评分" value={formatNullable(episodePlan.quality_score)} />
        <InfoRow label="Logline" value={episodePlan.logline || '未生成'} />
        <InfoRow label="开端" value={episodePlan.beginning || '未生成'} />
        <InfoRow label="中段" value={episodePlan.middle || '未生成'} />
        <InfoRow label="结尾" value={episodePlan.end || '未生成'} />
        <InfoRow label="剧情目标" value={episodePlan.plotGoal || '未生成'} />
        <InfoRow
          label="情绪曲线"
          value={
            (episodePlan.emotional_curve?.length ? episodePlan.emotional_curve : episodePlan.emotionCurve).length > 0
              ? (episodePlan.emotional_curve?.length ? episodePlan.emotional_curve : episodePlan.emotionCurve).join(' → ')
              : '未生成'
          }
        />
        <InfoRow label="关键场次" value={formatKeyScenes(episodePlan)} />
        <InfoRow
          label="爽点"
          value={episodePlan.coolPoints.length > 0 ? episodePlan.coolPoints.join('\n') : '未生成'}
        />
        <InfoRow label="结尾钩子" value={episodePlan.hook || '未生成'} />
        <InfoRow
          label="出场角色"
          value={
            (episodePlan.characters?.length ? episodePlan.characters : episodePlan.appearingCharacterNames).length > 0
              ? (episodePlan.characters?.length ? episodePlan.characters : episodePlan.appearingCharacterNames).join('、')
              : '未绑定角色资产'
          }
        />
        <InfoRow
          label="出现场景"
          value={
            (episodePlan.locations?.length ? episodePlan.locations : episodePlan.appearingLocationNames).length > 0
              ? (episodePlan.locations?.length ? episodePlan.locations : episodePlan.appearingLocationNames).join('、')
              : '未绑定场景资产'
          }
        />
        <InfoRow label="生产状态" value={episodePlan.productionStatus || '未生成'} />
        <InfoRow
          label="来源证据"
          value={
            (episodePlan.source_evidence?.length ? episodePlan.source_evidence : episodePlan.sourceEvidence).length > 0
              ? (episodePlan.source_evidence?.length ? episodePlan.source_evidence : episodePlan.sourceEvidence).join('\n')
              : '未生成'
          }
        />
        <InfoRow
          label="阻断原因"
          value={
            episodePlan.blockers?.length
              ? episodePlan.blockers.join('\n')
              : episodePlan.missingReasons?.length
                ? episodePlan.missingReasons.join('\n')
                : episodePlan.missingReason || '无'
          }
        />
        <InfoRow label="协议版本" value={episodePlan.version || '未生成'} />
      </div>
    </article>
  );
}

function formatNullable(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '未生成';
}

function formatKeyScenes(episodePlan: EpisodePlanDTO): string {
  const scenes = episodePlan.key_scenes || [];
  if (!scenes.length) return '未生成';
  return scenes
    .map((scene) =>
      [
        `${scene.scene_id} · ${scene.title}`,
        scene.summary,
        `功能：${scene.function}`,
        scene.source_evidence.length ? `证据：${scene.source_evidence.join('；')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
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
