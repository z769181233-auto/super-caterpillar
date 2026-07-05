'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, StoryboardAssetDTO } from '@scu/shared-types';
import {
  generateStudioStoryboardAssets,
  getStudioProductionState,
  getStudioStoryboardImageReadiness,
  getStudioStoryboardAssets,
} from './api';
import type { StoryboardImageReadinessDTO } from './api';
import {
  formatStudioGenerationError,
  getStoryboardAssetGenerationGate,
} from './studio-generation-blockers';
import { StudioLayout } from './StudioLayout';

interface StudioStoryboardAssetPageProps {
  locale: string;
  projectId: string;
  episodeId: string;
}

export function StudioStoryboardAssetPage({
  locale,
  projectId,
  episodeId,
}: StudioStoryboardAssetPageProps) {
  const [state, setState] = useState<ProductionStateDTO | null>(null);
  const [assets, setAssets] = useState<StoryboardAssetDTO[]>([]);
  const [imageReadiness, setImageReadiness] = useState<StoryboardImageReadinessDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getStudioProductionState(projectId),
      getStudioStoryboardAssets(projectId),
      getStudioStoryboardImageReadiness(projectId),
    ])
      .then(([nextState, nextAssets, nextImageReadiness]) => {
        if (!mounted) return;
        setState(nextState);
        setAssets(nextAssets);
        setImageReadiness(nextImageReadiness);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const storyboardStage = useMemo(
    () => state?.stages.find((stage) => stage.key === 'storyboard_ready') || null,
    [state]
  );
  const displayableAssets = assets.filter((asset) => asset.status !== 'missing');
  const visibleAssets = useMemo(() => {
    if (!episodeId || episodeId === 'episode-placeholder') return displayableAssets;
    const matching = displayableAssets.filter((asset) => asset.episodeId === episodeId);
    return matching.length > 0 ? matching : displayableAssets;
  }, [episodeId, displayableAssets]);
  const readyAssets = visibleAssets.filter(
    (asset) => asset.status === 'done' && asset.assetKind === 'text_binding'
  );
  const hasReadyAssets = readyAssets.length > 0;
  const generationGate = useMemo(
    () => getStoryboardAssetGenerationGate(state, hasReadyAssets),
    [state, hasReadyAssets]
  );
  const metrics = useMemo(() => calculateStoryboardMetrics(visibleAssets), [visibleAssets]);

  async function handleGenerate() {
    if (!generationGate.canGenerate) {
      setError(generationGate.reason);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const nextAssets = await generateStudioStoryboardAssets(projectId);
      const nextState = await getStudioProductionState(projectId);
      const nextImageReadiness = await getStudioStoryboardImageReadiness(projectId);
      setAssets(nextAssets);
      setState(nextState);
      setImageReadiness(nextImageReadiness);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate Studio StoryboardAsset';
      setError(formatStudioGenerationError(message, 'StoryboardAsset 文本绑定'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <StudioLayout locale={locale} projectId={projectId} state={state}>
      <section style={panelStyle()}>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Phase 2A：只生成 StoryboardAsset 文本绑定，不生成分镜图/图片/视频，不接 worker/job
        </p>
        <div style={headerStyle()}>
          <div>
            <h1 style={{ margin: 0 }}>分镜文本资产 StoryboardAsset</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              从 ready ShotScript 绑定每个镜头的分镜提示词、画面描述、镜头语言和连续性备注。这里是视觉生成前的文本资产层。
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !generationGate.canGenerate}
            style={primaryButtonStyle(generationGate.canGenerate)}
          >
            {generating ? '生成中...' : hasReadyAssets ? '重新生成文本分镜' : '生成文本分镜'}
          </button>
        </div>

        {error && <Callout tone="error" title="生成失败" body={error} />}

        {!generationGate.canGenerate && generationGate.reason && (
          <Callout tone="error" title="生成入口已暂停" body={generationGate.reason} />
        )}

        {!hasReadyAssets && (
          <Callout
            tone="warn"
            title="StoryboardAsset 未生成"
            body={
              storyboardStage?.missingReason ||
              assets[0]?.missingReason ||
              '当前还没有 StoryboardAsset 文本绑定。这里不会把旧图片资产或 ShotScript 提示词伪装成分镜资产 ready。'
            }
          />
        )}

        <Callout
          tone="info"
          title="视觉生成仍锁定"
          body="StoryboardAsset 只保存文本绑定：assetKind=text_binding、assetUrl 为空、locked=true。不会创建图片、视频、worker 或 job；后续图片分镜必须进入独立视觉资产阶段。"
        />

        <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', marginTop: '1rem', padding: '1rem' }}>
          <div style={cardHeaderStyle()}>
            <div>
              <h2 style={{ margin: 0 }}>图片生成准备度</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>
                Phase 2D 第一段只检查生成前条件和成本预估，不调用图片模型，不创建 worker/job。
              </p>
            </div>
            <strong style={{ color: imageReadiness?.status === 'ready' ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {imageReadiness?.status === 'ready' ? 'READY / PLAN' : 'BLOCKED'}
            </strong>
          </div>
          <div style={metricsGridStyle()}>
            <MetricCard label="Ready shots" value={`${imageReadiness?.readyShotCount ?? 0}`} />
            <MetricCard label="文本分镜覆盖" value={formatPercent(imageReadiness?.textBindingCoverageRate ?? 0)} />
            <MetricCard label="角色绑定" value={formatPercent(imageReadiness?.characterBindingRate ?? 0)} />
            <MetricCard label="场景绑定" value={formatPercent(imageReadiness?.locationBindingRate ?? 0)} />
            <MetricCard label="Prompt 完整度" value={formatPercent(imageReadiness?.promptCompletenessRate ?? 0)} />
            <MetricCard label="连续性覆盖" value={formatPercent(imageReadiness?.continuityCoverageRate ?? 0)} />
            <MetricCard label="成本单位预估" value={`${imageReadiness?.estimatedCostUnits ?? 0}`} />
          </div>
          {imageReadiness?.blockers.length ? (
            <Callout tone="warn" title="图片生成仍未开放" body={imageReadiness.blockers.join('\n')} />
          ) : (
            <Callout
              tone="info"
              title="准备度通过，但仍不生成图片"
              body={imageReadiness?.nextAction || '下一阶段需要单独审批真实图片生成。'}
            />
          )}
          <button type="button" disabled style={primaryButtonStyle(false)}>
            生成图片 · 后续阶段开放
          </button>
        </section>

        <div style={metricsGridStyle()}>
          <MetricCard label="文本分镜数" value={`${metrics.assetCount}`} />
          <MetricCard label="Shot 覆盖率" value={formatPercent(metrics.shotCoverage)} />
          <MetricCard label="Prompt 覆盖率" value={formatPercent(metrics.promptCoverage)} />
          <MetricCard label="Continuity 覆盖率" value={formatPercent(metrics.continuityCoverage)} />
        </div>

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
          {visibleAssets.length > 0 ? (
            visibleAssets.map((asset) => <StoryboardAssetCard key={asset.id || asset.shotId || asset.shotNo} asset={asset} />)
          ) : (
            <InfoRow label="当前状态" value="未生成 StoryboardAsset 文本绑定" />
          )}
        </div>
      </section>
    </StudioLayout>
  );
}

function StoryboardAssetCard({ asset }: { asset: StoryboardAssetDTO }) {
  return (
    <article style={cardStyle()}>
      <div style={cardHeaderStyle()}>
        <h2 style={{ margin: 0 }}>镜头 {asset.shotNo || '-'} · 文本分镜</h2>
        <strong style={{ color: asset.status === 'done' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {asset.status.toUpperCase()}
        </strong>
      </div>
      <div style={summaryGridStyle()}>
        <SummaryItem label="场景" value={asset.sceneId || asset.locationId || '未绑定'} />
        <SummaryItem label="角色" value={asset.characters.join('、') || '未绑定'} />
        <SummaryItem label="镜头语言" value={asset.cameraLanguage || '未生成'} />
        <SummaryItem label="资产类型" value={asset.assetKind === 'text_binding' ? '文本绑定' : '图片资产'} />
      </div>
      <p style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{asset.frameDescription || asset.prompt || '未生成画面描述'}</p>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>查看绑定详情</summary>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.9rem' }}>
          <InfoRow label="prompt" value={asset.prompt || '未生成'} />
          <InfoRow label="sourceShotScriptId" value={asset.sourceShotScriptId || '未绑定'} />
          <InfoRow label="sourcePrompt" value={asset.sourcePrompt || '未绑定'} />
          <InfoRow label="continuityNotes" value={asset.continuityNotes.join('\n') || '未生成'} />
          <InfoRow label="视觉生成边界" value={`assetUrl=${asset.assetUrl || 'null'}；assetStorageKey=${asset.assetStorageKey || 'null'}；locked=${String(asset.locked)}`} />
        </div>
      </details>
    </article>
  );
}

function calculateStoryboardMetrics(assets: StoryboardAssetDTO[]) {
  const assetCount = assets.filter((asset) => asset.status !== 'missing').length;
  const textAssets = assets.filter((asset) => asset.status === 'done' && asset.assetKind === 'text_binding');
  const promptCount = textAssets.filter((asset) => asset.prompt && asset.frameDescription && asset.cameraLanguage).length;
  const continuityCount = textAssets.filter((asset) => asset.continuityNotes.length > 0).length;
  return {
    assetCount,
    shotCoverage: assetCount > 0 ? textAssets.length / assetCount : 0,
    promptCoverage: textAssets.length > 0 ? promptCount / textAssets.length : 0,
    continuityCoverage: textAssets.length > 0 ? continuityCount / textAssets.length : 0,
  };
}

function Callout({ tone, title, body }: { tone: 'info' | 'warn' | 'error'; title: string; body: string | null }) {
  const color = tone === 'error' ? 'var(--hsl-error)' : tone === 'warn' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', marginTop: '1rem', padding: '1rem' }}>
      <strong style={{ color }}>{title}</strong>
      {body && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0, whiteSpace: 'pre-line' }}>{body}</p>}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle()}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</div>
      <strong style={{ color: 'var(--text-primary)', fontSize: '1.35rem' }}>{value}</strong>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{value}</div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function panelStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    padding: '1.5rem',
  };
}

function headerStyle(): React.CSSProperties {
  return {
    alignItems: 'flex-start',
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
  };
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? 'var(--accent)' : 'var(--border-subtle)',
    border: 'none',
    borderRadius: '999px',
    color: enabled ? '#0f1115' : 'var(--text-secondary)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 800,
    minWidth: '168px',
    padding: '0.85rem 1.15rem',
  };
}

function metricsGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    marginTop: '1.25rem',
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    padding: '1rem',
  };
}

function cardHeaderStyle(): React.CSSProperties {
  return {
    alignItems: 'center',
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
  };
}

function summaryGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    marginTop: '1rem',
  };
}
