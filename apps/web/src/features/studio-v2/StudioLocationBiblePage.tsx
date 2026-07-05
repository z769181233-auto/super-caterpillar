'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { LocationBibleDTO, ProductionStateDTO } from '@scu/shared-types';
import {
  generateStudioLocationBibles,
  getStudioLocationBibles,
  getStudioProductionState,
} from './api';
import { StudioLayout } from './StudioLayout';

interface StudioLocationBiblePageProps {
  locale: string;
  projectId: string;
}

export function StudioLocationBiblePage({ locale, projectId }: StudioLocationBiblePageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [locations, setLocations] = useState<LocationBibleDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStudioProductionState(projectId), getStudioLocationBibles(projectId)])
      .then(([nextState, nextLocations]) => {
        if (!mounted) return;
        setState(nextState);
        setLocations(nextLocations);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const locationStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'locations_ready') || null,
    [state]
  );
  const realLocations = locations.filter((location) => location.status === 'done');
  const isDone = realLocations.length > 0;
  const metrics = {
    count: realLocations.length,
    shotCoverage: getEvidenceValue(locationStage, 'shotLocationCoverage') || '未评估',
    storyboardCoverage: getEvidenceValue(locationStage, 'storyboardLocationCoverage') || '未评估',
    evidenceCoverage: getEvidenceValue(locationStage, 'sourceEvidenceCoverage') || '未评估',
    status: locationStage?.status || 'missing',
  };

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const nextLocations = await generateStudioLocationBibles(projectId);
      const nextState = await getStudioProductionState(projectId);
      setLocations(nextLocations);
      setState(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Studio LocationBible');
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
          Phase 2C：只生成 LocationBible，不接图片/视频
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
            <h1 style={{ margin: 0 }}>场景资产 LocationBible</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 StoryBible、角色资产、小说章节和旧场景中抽取可复用场景资产，生成场景功能、建筑风格、光影氛围、道具和可复用镜头提示词。
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
            {generating ? '生成中...' : isDone ? '重新生成场景资产' : '生成场景资产'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!isDone && (
          <Callout
            tone="warn"
            title="场景资产未生成"
            body={
              locationStage?.missingReason ||
              locations[0]?.missingReason ||
              '当前还没有 LocationBible。这里不会把旧 location 文本或场景摘要伪装成场景资产。'
            }
          />
        )}

        {isDone && locationStage?.status === 'blocked' && (
          <Callout
            tone="error"
            title="场景一致性未过关"
            body={
              locationStage.missingReason ||
              '当前 LocationBible 尚未覆盖 ShotScript / StoryboardAsset 中的地点，不能进入视觉生成。'
            }
          />
        )}

        <Callout
          tone="info"
          title="边界说明"
          body="本页只生成结构化场景文字资产。场景概念图、氛围图、分镜图和视频仍未生成，assetIds 为空是预期结果。"
        />

        <div style={metricsGridStyle()}>
          <MetricCard label="场景数" value={`${metrics.count}`} />
          <MetricCard label="状态" value={metrics.status.toUpperCase()} />
          <MetricCard label="ShotScript 地点覆盖率" value={metrics.shotCoverage} />
          <MetricCard label="StoryboardAsset 地点覆盖率" value={metrics.storyboardCoverage} />
          <MetricCard label="source evidence 覆盖率" value={metrics.evidenceCoverage} />
        </div>

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {realLocations.length > 0 ? (
            realLocations.map((location) => (
              <LocationCard key={location.id || location.name} location={location} />
            ))
          ) : (
            <InfoRow label="当前状态" value="未生成场景资产" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function LocationCard({ location }: { location: LocationBibleDTO }) {
  return (
    <article
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <h2 style={{ marginTop: 0 }}>{location.name}</h2>
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <InfoRow label="功能定位" value={location.functionRole || '未生成'} />
        <InfoRow label="稳定 locationId" value={location.locationId || '未绑定'} />
        <InfoRow label="建筑风格" value={location.architectureStyle || '未生成'} />
        <InfoRow label="光影氛围" value={location.lightingMood || '未生成'} />
        <InfoRow label="场景道具" value={location.props.length > 0 ? location.props.join('、') : '未生成'} />
        <InfoRow
          label="可复用镜头"
          value={
            location.reusableShotPrompts.length > 0
              ? location.reusableShotPrompts.join('\n')
              : '未生成'
          }
        />
        <InfoRow label="场景视觉提示词" value={location.visualPrompt || '未生成'} />
        <InfoRow
          label="关联剧集"
          value={location.linkedEpisodeIds.length > 0 ? location.linkedEpisodeIds.join('\n') : '暂无绑定'}
        />
        <InfoRow
          label="关联镜头"
          value={location.linkedShotIds.length > 0 ? location.linkedShotIds.join('\n') : '暂无绑定'}
        />
        <InfoRow
          label="已生成图片/视频资产"
          value={location.assetIds.length > 0 ? location.assetIds.join('\n') : '暂无图片/视频资产'}
        />
        <InfoRow
          label="来源证据"
          value={location.sourceEvidence.length > 0 ? location.sourceEvidence.join('\n') : '未生成'}
        />
        <InfoRow label="协议版本" value={location.version || '未生成'} />
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</div>
      <strong style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>{value}</strong>
    </div>
  );
}

function getEvidenceValue(stage: { evidence: string[] } | null, name: string): string | null {
  const prefix = `${name}:`;
  const line = stage?.evidence.find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length) : null;
}

function metricsGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    marginTop: '1.25rem',
  };
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
