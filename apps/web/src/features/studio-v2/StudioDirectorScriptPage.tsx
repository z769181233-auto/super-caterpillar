'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { DirectorScriptDTO, ProductionStateDTO } from '@scu/shared-types';
import {
  generateStudioDirectorScripts,
  getStudioDirectorScripts,
  getStudioProductionState,
} from './api';
import { formatStudioGenerationError } from './studio-generation-blockers';
import { StudioLayout } from './StudioLayout';

interface StudioDirectorScriptPageProps {
  locale: string;
  projectId: string;
  episodeId: string;
}

export function StudioDirectorScriptPage({
  locale,
  projectId,
  episodeId,
}: StudioDirectorScriptPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [directorScripts, setDirectorScripts] = useState<DirectorScriptDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioDirectorScripts(projectId)])
      .then(([nextState, nextDirectorScripts]) => {
        if (!mounted) return;
        setState(nextState);
        setDirectorScripts(nextDirectorScripts);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const directorStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'director_script_ready') || null,
    [state]
  );
  const realDirectorScripts = directorScripts.filter(
    (directorScript) => directorScript.status === 'done'
  );
  const visibleDirectorScripts = useMemo(() => {
    if (!episodeId || episodeId === 'episode-placeholder') return realDirectorScripts;
    const matching = realDirectorScripts.filter((directorScript) => directorScript.episodeId === episodeId);
    return matching.length > 0 ? matching : realDirectorScripts;
  }, [episodeId, realDirectorScripts]);
  const isDone = realDirectorScripts.length > 0;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextDirectorScripts = await generateStudioDirectorScripts(projectId);
      const nextState = await getStudioProductionState(projectId);
      setDirectorScripts(nextDirectorScripts);
      setState(nextState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Studio DirectorScript';
      setError(formatStudioGenerationError(message, '导演剧本'));
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
          Phase 2E：只生成 DirectorScript，不接镜头台本/分镜/图片/视频
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
            <h1 style={{ margin: 0 }}>导演剧本 DirectorScript</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从已生成的 EpisodePlan 生成每集导演层执行稿：剧情 logline、场次节奏、关键人物、关键场景、视觉基调、对白口吻、声音方向和导演备注。
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
            {generating ? '生成中...' : isDone ? '重新生成导演剧本' : '生成导演剧本'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="导演剧本未生成"
            body={
              directorStage?.missingReason ||
              directorScripts[0]?.missingReason ||
              '当前还没有 DirectorScript。这里不会把旧剧情章节、旧场景摘要或旧视频脚本伪装成正式导演剧本。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成导演层结构化文本。ShotScript、分镜图、StoryboardAsset、图片资产、视频提示词和镜头视频仍未生成。"
        />

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {visibleDirectorScripts.length > 0 ? (
            visibleDirectorScripts.map((directorScript) => (
              <DirectorScriptCard
                key={directorScript.id || `${directorScript.episodeId}-${directorScript.title}`}
                directorScript={directorScript}
              />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成导演剧本" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function DirectorScriptCard({ directorScript }: { directorScript: DirectorScriptDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        第 {directorScript.episodeNo || '-'} 集 · {directorScript.title}
      </h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow label="导演 Logline" value={directorScript.logline || '未生成'} />
        <InfoRow
          label="导演节拍"
          value={directorScript.beats.length > 0 ? directorScript.beats.join('\n') : '未生成'}
        />
        <InfoRow
          label="场次节奏"
          value={directorScript.sceneBeats.length > 0 ? directorScript.sceneBeats.join('\n') : '未生成'}
        />
        <InfoRow
          label="关键人物"
          value={
            directorScript.keyCharacters.length > 0
              ? directorScript.keyCharacters.join('、')
              : '未绑定角色资产'
          }
        />
        <InfoRow
          label="关键场景"
          value={
            directorScript.keyLocations.length > 0
              ? directorScript.keyLocations.join('、')
              : '未绑定场景资产'
          }
        />
        <InfoRow label="视觉基调" value={directorScript.visualTone || '未生成'} />
        <InfoRow label="对白口吻" value={directorScript.dialogueStyle || '未生成'} />
        <InfoRow label="声音方向" value={directorScript.soundDesign || '未生成'} />
        <InfoRow label="节奏说明" value={directorScript.pacingNotes || '未生成'} />
        <InfoRow
          label="导演备注"
          value={
            directorScript.directorNotes.length > 0 ? directorScript.directorNotes.join('\n') : '未生成'
          }
        />
        <InfoRow label="来源 EpisodePlan" value={directorScript.sourceEpisodePlanId || '未绑定'} />
        <InfoRow
          label="来源证据"
          value={
            directorScript.sourceEvidence.length > 0 ? directorScript.sourceEvidence.join('\n') : '未生成'
          }
        />
        <InfoRow label="协议版本" value={directorScript.version || '未生成'} />
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
