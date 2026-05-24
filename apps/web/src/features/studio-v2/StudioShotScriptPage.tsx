'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, ShotScriptDTO } from '@scu/shared-types';
import {
  generateStudioShotScripts,
  getStudioProductionState,
  getStudioShotScripts,
} from './api';
import {
  formatStudioGenerationError,
  getShotScriptGenerationGate,
} from './studio-generation-blockers';
import { StudioLayout } from './StudioLayout';

interface StudioShotScriptPageProps {
  locale: string;
  projectId: string;
  episodeId: string;
}

export function StudioShotScriptPage({ locale, projectId, episodeId }: StudioShotScriptPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [shotScripts, setShotScripts] = useState<ShotScriptDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioShotScripts(projectId)])
      .then(([nextState, nextShotScripts]) => {
        if (!mounted) return;
        setState(nextState);
        setShotScripts(nextShotScripts);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const shotStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'shot_script_ready') || null,
    [state]
  );
  const realShotScripts = shotScripts.filter((shotScript) => shotScript.status !== 'missing');
  const visibleShotScripts = useMemo(() => {
    if (!episodeId || episodeId === 'episode-placeholder') return realShotScripts;
    const matching = realShotScripts.filter((shotScript) => shotScript.episode_id === episodeId);
    return matching.length > 0 ? matching : realShotScripts;
  }, [episodeId, realShotScripts]);
  const isDone = realShotScripts.length > 0;
  const generationGate = useMemo(
    () => getShotScriptGenerationGate(state, isDone),
    [state, isDone]
  );

  async function handleGenerate() {
    if (!generationGate.canGenerate) {
      setError(generationGate.reason);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const nextShotScripts = await generateStudioShotScripts(projectId);
      const nextState = await getStudioProductionState(projectId);
      setShotScripts(nextShotScripts);
      setState(nextState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Studio ShotScript';
      setError(formatStudioGenerationError(message, '镜头台本'));
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
          Phase 1B-C：只生成第一集 8-20 个 ShotScript，不接分镜图/图片/视频/worker
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
            <h1 style={{ margin: 0 }}>镜头台本 ShotScript</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 ready DirectorScript 拆出镜头级结构：shot_id、时长、景别、运镜、角色动作、对白、旁白、声音、光影、情绪、分镜提示词和视频提示词文本草案。
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !generationGate.canGenerate}
            style={{
              background: generationGate.canGenerate ? 'var(--accent)' : 'var(--border-subtle)',
              border: 'none',
              borderRadius: '999px',
              color: generationGate.canGenerate ? '#0f1115' : 'var(--text-secondary)',
              cursor: generating || !generationGate.canGenerate ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              minWidth: '158px',
              padding: '0.85rem 1.15rem',
            }}
          >
            {generating ? '生成中...' : isDone ? '重新生成镜头台本' : '生成镜头台本'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!generationGate.canGenerate && generationGate.reason && (
          <Callout tone="error" title="生成入口已暂停" body={generationGate.reason} />
        )}

        {state?.shotScriptQualityGate &&
          state.shotScriptQualityGate.status !== 'passed' && (
            <Callout
              tone={state.shotScriptQualityGate.status === 'blocked' ? 'error' : 'warn'}
              title="镜头台本质量门槛"
              body={[
                `状态：${state.shotScriptQualityGate.status}`,
                `镜头候选：${state.shotScriptQualityGate.candidateShotCount}/${state.shotScriptQualityGate.minShotCount}`,
                `对白/旁白覆盖：${formatPercent(state.shotScriptQualityGate.dialogueExtractionRate)}`,
                `source evidence 覆盖：${formatPercent(state.shotScriptQualityGate.evidenceBindingRate)}`,
                state.shotScriptQualityGate.reasons.length
                  ? `原因：${state.shotScriptQualityGate.reasons.join('；')}`
                  : null,
                state.shotScriptQualityGate.nextAction
                  ? `下一步：${state.shotScriptQualityGate.nextAction}`
                  : null,
              ]
                .filter(Boolean)
                .join('\n')}
            />
          )}

        {!isDone && (
          <Callout
            tone="warn"
            title="镜头台本未生成"
            body={
              shotStage?.missingReason ||
              shotScripts[0]?.missing_reason ||
              '当前还没有 ShotScript。这里不会把旧 Shot、旧摘要或旧视频脚本文本伪装成标准镜头台本。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成镜头级结构化文本和提示词草案。storyboard_prompt 是分镜提示词文本，不生成图片；video_prompt 是视频提示词文本草案，不调用视频生成；不会启动 worker 或新增 job。"
        />

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {visibleShotScripts.length > 0 ? (
            visibleShotScripts.map((shotScript) => (
              <ShotScriptCard key={shotScript.shot_id} shotScript={shotScript} />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成镜头台本" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function ShotScriptCard({ shotScript }: { shotScript: ShotScriptDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        镜头 {shotScript.shot_no} · {shotScript.duration_sec}s · {shotScript.shot_size}
      </h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow label="Shot ID" value={shotScript.shot_id} />
        <InfoRow label="状态" value={shotScript.status} />
        <InfoRow label="集 ID / 场 ID" value={`${shotScript.episode_id} / ${shotScript.scene_id}`} />
        <InfoRow label="场景资产" value={shotScript.location_id || '未绑定 LocationBible'} />
        <InfoRow
          label="主角色绑定"
          value={[
            `character_id: ${shotScript.character_id || '未绑定'}`,
            `costume_id: ${shotScript.costume_id || '未绑定'}`,
            `expression: ${shotScript.expression || '未生成'}`,
            `position: ${shotScript.position || '未生成'}`,
          ].join('\n')}
        />
        <InfoRow
          label="角色资产"
          value={
            shotScript.characters.length > 0
              ? shotScript.characters
                  .map(
                    (character) =>
                      `${character.character_name}（${character.expression || '表情待定'} / ${character.position || '站位待定'}）`
                  )
                  .join('\n')
              : '未绑定 CharacterBible'
          }
        />
        <InfoRow label="动作" value={shotScript.action} />
        <InfoRow label="景别 / 运镜" value={`${shotScript.shot_size} / ${shotScript.camera_movement}`} />
        <InfoRow
          label="对白"
          value={
            shotScript.dialogue.length > 0
              ? shotScript.dialogue
                  .map((line) => `${line.character_name || '旁白'}：${line.text}`)
                  .join('\n')
              : '无对白'
          }
        />
        <InfoRow label="旁白" value={shotScript.voiceover || '无旁白'} />
        <InfoRow
          label="声音设计"
          value={shotScript.sound_design.length > 0 ? shotScript.sound_design.join('\n') : '未生成'}
        />
        <InfoRow label="光影" value={shotScript.lighting} />
        <InfoRow label="情绪" value={shotScript.emotion} />
        <InfoRow label="画面目标" value={shotScript.visual_goal} />
        <InfoRow label="剧情功能" value={shotScript.plot_function} />
        <InfoRow label="Storyboard Prompt 文本准备态" value={shotScript.storyboard_prompt || '未生成'} />
        <InfoRow label="Video Prompt 文本准备态" value={shotScript.video_prompt || '未生成'} />
        <InfoRow
          label="连续性备注"
          value={
            shotScript.continuity_notes.length > 0
              ? shotScript.continuity_notes.join('\n')
              : '未生成'
          }
        />
        <InfoRow
          label="来源证据"
          value={shotScript.source_evidence.length > 0 ? shotScript.source_evidence.join('\n') : '未绑定'}
        />
        <InfoRow label="质量评分" value={formatQualityScore(shotScript.quality_score)} />
        <InfoRow
          label="阻断原因"
          value={formatBlockers(shotScript)}
        />
        <InfoRow label="来源 DirectorScript" value={shotScript.source_director_script_id || '未绑定'} />
        <InfoRow label="协议版本" value={shotScript.version || '未生成'} />
      </div>
    </article>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? '未评估' : `${Math.round(value * 100)}%`;
}

function formatQualityScore(score: ShotScriptDTO['quality_score']): string {
  if (!score) return '未生成';
  return [
    `overall: ${score.overall ?? '未评估'}`,
    `story_clarity: ${score.story_clarity ?? '未评估'}`,
    `character_consistency: ${score.character_consistency ?? '未评估'}`,
    `location_consistency: ${score.location_consistency ?? '未评估'}`,
    `cinematic_quality: ${score.cinematic_quality ?? '未评估'}`,
    `publish_readiness: ${score.publish_readiness ?? '未评估'}`,
    `needs_revision: ${score.needs_revision ? '是' : '否'}`,
  ].join('\n');
}

function formatBlockers(shotScript: ShotScriptDTO): string {
  const blockers = [
    ...((shotScript as ShotScriptDTO & { blockers?: string[] }).blockers || []),
    ...((shotScript as ShotScriptDTO & { missingReasons?: string[] }).missingReasons || []),
  ];
  return blockers.length > 0 ? Array.from(new Set(blockers)).join('\n') : '无';
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
