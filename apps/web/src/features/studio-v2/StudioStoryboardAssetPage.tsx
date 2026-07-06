'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProductionStateDTO, StoryboardAssetDTO } from '@scu/shared-types';
import {
  dryRunStudioStoryboardImageGeneration,
  generateOneStudioStoryboardImage,
  generateStudioStoryboardAssets,
  getStudioProductionState,
  getStudioStoryboardImageReadiness,
  getStudioStoryboardAssets,
} from './api';
import type {
  StoryboardImageGenerateOneDTO,
  StoryboardImageGenerationDryRunDTO,
  StoryboardImageReadinessDTO,
} from './api';
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
  const [imageDryRun, setImageDryRun] = useState<StoryboardImageGenerationDryRunDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [imageModel, setImageModel] = useState('gpt-image-1');
  const [imageSize, setImageSize] = useState('16:9');
  const [imageQuality, setImageQuality] = useState('standard');
  const [costConfirmed, setCostConfirmed] = useState(false);
  const [showDryRunDialog, setShowDryRunDialog] = useState(false);
  const [selectedImageAsset, setSelectedImageAsset] = useState<StoryboardAssetDTO | null>(null);
  const [singleShotConfirmations, setSingleShotConfirmations] = useState({
    cost: false,
    singleShot: false,
    noVideo: false,
    providerCall: false,
    noWorkerJob: false,
  });
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generateOneResult, setGenerateOneResult] = useState<StoryboardImageGenerateOneDTO | null>(null);

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
  const textBindingAssets = visibleAssets.filter((asset) => asset.assetKind === 'text_binding');
  const imageAssets = visibleAssets.filter((asset) => asset.assetKind === 'image');
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

  async function handleDryRunImageGeneration() {
    setDryRunning(true);
    setError(null);
    try {
      const nextDryRun = await dryRunStudioStoryboardImageGeneration(projectId, {
        episodeId: episodeId && episodeId !== 'episode-placeholder' ? episodeId : null,
        imageModel,
        imageSize,
        imageQuality,
        confirmCost: costConfirmed,
      });
      setImageDryRun(nextDryRun);
      setShowDryRunDialog(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to dry-run Studio storyboard image generation';
      setError(formatStudioGenerationError(message, 'Storyboard 图片生成预估'));
    } finally {
      setDryRunning(false);
    }
  }

  function openSingleShotDialog(asset: StoryboardAssetDTO) {
    setSelectedImageAsset(asset);
    setGenerateOneResult(null);
    setSingleShotConfirmations({
      cost: false,
      singleShot: false,
      noVideo: false,
      providerCall: false,
      noWorkerJob: false,
    });
  }

  async function handleGenerateOneImage() {
    if (!selectedImageAsset?.sourceShotScriptId && !selectedImageAsset?.shotId) {
      setError('缺少目标镜头 shotId，不能执行单镜头图片生成。');
      return;
    }
    if (!singleShotConfirmations.cost || !singleShotConfirmations.singleShot || !singleShotConfirmations.noVideo || !singleShotConfirmations.providerCall || !singleShotConfirmations.noWorkerJob) {
      setError('请先完成所有单镜头生成确认项。');
      return;
    }

    setGeneratingImage(true);
    setError(null);
    try {
      const result = await generateOneStudioStoryboardImage(projectId, {
        shotId: selectedImageAsset.sourceShotScriptId || selectedImageAsset.shotId || '',
        imageModel,
        imageSize,
        imageQuality,
        confirmCost: true,
        confirmSingleShot: true,
        confirmNoVideo: true,
        confirmProviderCall: true,
        confirmRealImageGeneration: true,
      });
      setGenerateOneResult(result);
      const [nextAssets, nextImageReadiness] = await Promise.all([
        getStudioStoryboardAssets(projectId),
        getStudioStoryboardImageReadiness(projectId),
      ]);
      setAssets(nextAssets);
      setImageReadiness(nextImageReadiness);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate one Studio storyboard image';
      setError(formatStudioGenerationError(message, '单镜头图片生成'));
    } finally {
      setGeneratingImage(false);
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
          title="当前只验收已存储图片展示"
          body="Phase 3A-I 只展示已经写入 storage 的单镜头图片资产，不调用图片模型、不批量生成、不创建 worker/job、不进入视频链路。"
        />

        <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', marginTop: '1rem', padding: '1rem' }}>
          <div style={cardHeaderStyle()}>
            <div>
              <h2 style={{ margin: 0 }}>图片生成准备度</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>
                Phase 3A-B：只做生成前 dry-run、成本预估和确认弹窗，不调用图片模型，不创建 worker/job。
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

          <div style={formGridStyle()}>
            <label style={fieldStyle()}>
              <span style={fieldLabelStyle()}>图片模型</span>
              <select value={imageModel} onChange={(event) => setImageModel(event.target.value)} style={inputStyle()}>
                <option value="gpt-image-1">gpt-image-1</option>
                <option value="image-generation-model-not-selected">暂不选择模型</option>
              </select>
            </label>
            <label style={fieldStyle()}>
              <span style={fieldLabelStyle()}>画幅</span>
              <select value={imageSize} onChange={(event) => setImageSize(event.target.value)} style={inputStyle()}>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </label>
            <label style={fieldStyle()}>
              <span style={fieldLabelStyle()}>质量</span>
              <select value={imageQuality} onChange={(event) => setImageQuality(event.target.value)} style={inputStyle()}>
                <option value="standard">standard</option>
                <option value="high">high</option>
                <option value="draft">draft</option>
              </select>
            </label>
          </div>

          <label style={checkboxStyle()}>
            <input
              type="checkbox"
              checked={costConfirmed}
              onChange={(event) => setCostConfirmed(event.target.checked)}
            />
            <span>确认仅做成本预估 dry-run；不会调用图片模型、不会产生费用、不会写入图片资产。</span>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={handleDryRunImageGeneration}
              disabled={dryRunning}
              style={primaryButtonStyle(!dryRunning)}
            >
              {dryRunning ? '预估中...' : '预估生成计划'}
            </button>
            <button type="button" disabled style={primaryButtonStyle(false)}>
              批量生成图片 · 未开放
            </button>
          </div>

          {imageDryRun && (
            <section style={{ ...cardStyle(), marginTop: '1rem' }}>
              <div style={cardHeaderStyle()}>
                <div>
                  <h3 style={{ margin: 0 }}>Dry-run 生成计划</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>
                    当前计划只用于评审真实图片生成入口，不会写入 metadata。
                  </p>
                </div>
                <strong style={{ color: imageDryRun.status === 'ready' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {imageDryRun.status.toUpperCase()}
                </strong>
              </div>
              <div style={metricsGridStyle()}>
                <MetricCard label="计划生成张数" value={`${imageDryRun.plannedImageCount}`} />
                <MetricCard label="预计成本单位" value={`${imageDryRun.estimatedCostUnits}`} />
                <MetricCard label="已有图片资产" value={`${imageDryRun.existingImageAssetCount}`} />
                <MetricCard label="模型" value={imageDryRun.imageModel || '未选择'} />
                <MetricCard label="画幅" value={imageDryRun.imageSize || '未选择'} />
                <MetricCard label="质量" value={imageDryRun.imageQuality || '未选择'} />
              </div>
              <InfoRow
                label="执行边界"
                value={`willGenerateImage=${String(imageDryRun.willGenerateImage)}；willCallProvider=${String(imageDryRun.willCallProvider)}；willCreateJob=${String(imageDryRun.willCreateJob)}；willWriteMetadata=${String(imageDryRun.willWriteMetadata)}`}
              />
              {imageDryRun.blockers.length > 0 ? (
                <Callout tone="warn" title="Dry-run blockers" body={imageDryRun.blockers.join('\n')} />
              ) : (
                <Callout tone="info" title="Dry-run 已通过" body={imageDryRun.nextAction} />
              )}
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>查看镜头级 image prompt 计划</summary>
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.9rem' }}>
                  {imageDryRun.assets.slice(0, 8).map((item) => (
                    <InfoRow
                      key={item.shotId || item.shotNo || item.sourceStoryboardAssetId}
                      label={`镜头 ${item.shotNo || '-'} · ${item.blockers.length ? 'BLOCKED' : 'READY'}`}
                      value={item.blockers.length ? item.blockers.join('\n') : item.imagePrompt || '未生成 image prompt'}
                    />
                  ))}
                </div>
              </details>
            </section>
          )}

          {showDryRunDialog && imageDryRun && (
            <div style={dialogBackdropStyle()} role="presentation">
              <section style={dialogStyle()} role="dialog" aria-modal="true" aria-labelledby="storyboard-image-dry-run-title">
                <h2 id="storyboard-image-dry-run-title" style={{ marginTop: 0 }}>图片生成确认 · Dry-run</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  本次只生成计划和成本预估，不调用图片模型、不产生费用、不写入图片资产、不创建 worker/job。
                </p>
                <div style={metricsGridStyle()}>
                  <MetricCard label="计划张数" value={`${imageDryRun.plannedImageCount}`} />
                  <MetricCard label="预计成本单位" value={`${imageDryRun.estimatedCostUnits}`} />
                  <MetricCard label="状态" value={imageDryRun.status.toUpperCase()} />
                </div>
                {imageDryRun.blockers.length > 0 && (
                  <Callout tone="warn" title="仍有阻断项" body={imageDryRun.blockers.join('\n')} />
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowDryRunDialog(false)} style={primaryButtonStyle(true)}>
                    我知道了
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>

        <div style={metricsGridStyle()}>
          <MetricCard label="文本分镜数" value={`${metrics.textAssetCount}`} />
          <MetricCard label="已存储图片" value={`${metrics.imageAssetCount}`} />
          <MetricCard label="Shot 覆盖率" value={formatPercent(metrics.shotCoverage)} />
          <MetricCard label="Prompt 覆盖率" value={formatPercent(metrics.promptCoverage)} />
          <MetricCard label="Continuity 覆盖率" value={formatPercent(metrics.continuityCoverage)} />
        </div>

        <section style={{ marginTop: '1.5rem' }}>
          <div style={cardHeaderStyle()}>
            <div>
              <h2 style={{ margin: 0 }}>已存储图片资产</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0.35rem 0 0' }}>
                展示 provider 返回图片转存 storage 后的结果；这里不会再次调用图片模型。
              </p>
            </div>
            <strong style={{ color: imageAssets.length > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {imageAssets.length > 0 ? 'STORED' : 'NOT STARTED'}
            </strong>
          </div>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {imageAssets.length > 0 ? (
              imageAssets.map((asset) => (
                <StoredImageAssetCard key={asset.id || asset.assetStorageKey || asset.shotId || asset.shotNo} asset={asset} />
              ))
            ) : (
              <InfoRow
                label="当前状态"
                value="还没有已存储图片资产。Storyboard / Image / Video 不会在本页面自动生成。"
              />
            )}
          </div>
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <div style={cardHeaderStyle()}>
            <div>
              <h2 style={{ margin: 0 }}>文本分镜资产</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0.35rem 0 0' }}>
                ShotScript 到 StoryboardAsset 的文本绑定层，作为图片生成前的结构化输入。
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {textBindingAssets.length > 0 ? (
              textBindingAssets.map((asset) => (
                <StoryboardAssetCard
                  key={asset.id || asset.shotId || asset.shotNo}
                  asset={asset}
                  existingImageAsset={findImageAssetForTextBinding(asset, imageAssets)}
                  onGenerateOne={openSingleShotDialog}
                />
              ))
            ) : (
              <InfoRow label="当前状态" value="未生成 StoryboardAsset 文本绑定" />
            )}
          </div>
        </section>

        {selectedImageAsset && (
          <div style={dialogBackdropStyle()} role="presentation">
            <section style={dialogStyle()} role="dialog" aria-modal="true" aria-labelledby="storyboard-generate-one-title">
              <div style={cardHeaderStyle()}>
                <div>
                  <h2 id="storyboard-generate-one-title" style={{ margin: 0 }}>单镜头图片生成确认</h2>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 0 }}>
                    Phase 3A-J 只允许当前镜头生成一张图片。不会批量、不会生成视频、不会创建 worker/job。
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedImageAsset(null)} style={secondaryButtonStyle()}>
                  关闭
                </button>
              </div>

              <div style={metricsGridStyle()}>
                <MetricCard label="镜头" value={`${selectedImageAsset.shotNo || '-'}`} />
                <MetricCard label="模型" value={imageModel} />
                <MetricCard label="画幅" value={imageSize} />
                <MetricCard label="质量" value={imageQuality} />
              </div>

              <InfoRow
                label="image prompt 摘要"
                value={selectedImageAsset.sourcePrompt || selectedImageAsset.prompt || selectedImageAsset.frameDescription || '未生成 image prompt'}
              />

              <div style={{ display: 'grid', gap: '0.7rem', marginTop: '1rem' }}>
                <ConfirmationCheckbox
                  checked={singleShotConfirmations.singleShot}
                  label="我确认只生成当前单个镜头，不执行批量生成。"
                  onChange={(checked) => setSingleShotConfirmations((current) => ({ ...current, singleShot: checked }))}
                />
                <ConfirmationCheckbox
                  checked={singleShotConfirmations.cost}
                  label="我确认已查看 dry-run 成本预估，并接受单镜头成本。"
                  onChange={(checked) => setSingleShotConfirmations((current) => ({ ...current, cost: checked }))}
                />
                <ConfirmationCheckbox
                  checked={singleShotConfirmations.providerCall}
                  label="我确认本次会调用已配置的图片 provider。"
                  onChange={(checked) => setSingleShotConfirmations((current) => ({ ...current, providerCall: checked }))}
                />
                <ConfirmationCheckbox
                  checked={singleShotConfirmations.noVideo}
                  label="我确认不会生成视频，也不会调用视频链路。"
                  onChange={(checked) => setSingleShotConfirmations((current) => ({ ...current, noVideo: checked }))}
                />
                <ConfirmationCheckbox
                  checked={singleShotConfirmations.noWorkerJob}
                  label="我确认不会创建 worker/job。"
                  onChange={(checked) => setSingleShotConfirmations((current) => ({ ...current, noWorkerJob: checked }))}
                />
              </div>

              {generateOneResult && (
                <section style={{ ...cardStyle(), marginTop: '1rem' }}>
                  <div style={cardHeaderStyle()}>
                    <h3 style={{ margin: 0 }}>生成结果</h3>
                    <strong style={{ color: generateOneResult.status === 'ready' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {formatGenerateOneAcceptanceState(generateOneResult.acceptanceState)}
                    </strong>
                  </div>
                  <InfoRow
                    label="验收状态"
                    value={describeGenerateOneAcceptanceState(generateOneResult.acceptanceState)}
                  />
                  {generateOneResult.blockers.length > 0 && (
                    <Callout tone="warn" title="阻断/失败原因" body={generateOneResult.blockers.join('\n')} />
                  )}
                  <InfoRow
                    label="providerCall"
                    value={`attempted=${String(generateOneResult.providerCall.attempted)}；provider=${generateOneResult.providerCall.provider || 'none'}；confirmed=${String(generateOneResult.providerCall.confirmed)}`}
                  />
                  <InfoRow
                    label="auditLog"
                    value={`recorded=${String(generateOneResult.auditLog.recorded)}；preflight=${String(generateOneResult.auditLog.preflightRecorded)}；attempt=${String(generateOneResult.auditLog.providerAttemptRecorded)}；success=${String(generateOneResult.auditLog.providerSuccessRecorded)}；failure=${String(generateOneResult.auditLog.providerFailureRecorded)}`}
                  />
                  <InfoRow
                    label="rollback"
                    value={`required=${String(generateOneResult.rollback.required)}；metadataWritten=${String(generateOneResult.rollback.metadataWritten)}；metadataRestored=${String(generateOneResult.rollback.metadataRestored)}；reason=${generateOneResult.rollback.reason || 'none'}`}
                  />
                  {generateOneResult.asset?.assetUrl && (
                    <InfoRow
                      label="stored image"
                      value={`assetKind=${generateOneResult.asset.assetKind}；storageKey=${generateOneResult.asset.assetStorageKey || '未写入'}；url=${generateOneResult.asset.assetUrl}`}
                    />
                  )}
                  <InfoRow
                    label="执行边界"
                    value={`willCreateJob=${String(generateOneResult.willCreateJob)}；willGenerateVideo=${String(generateOneResult.willGenerateVideo)}；${generateOneResult.nextAction}`}
                  />
                </section>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setSelectedImageAsset(null)} style={secondaryButtonStyle()}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleGenerateOneImage}
                  disabled={generatingImage || !isSingleShotConfirmed(singleShotConfirmations)}
                  style={primaryButtonStyle(!generatingImage && isSingleShotConfirmed(singleShotConfirmations))}
                >
                  {generatingImage ? '生成中...' : '确认生成当前镜头'}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </StudioLayout>
  );
}

function StoredImageAssetCard({ asset }: { asset: StoryboardAssetDTO }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const hasPreview = Boolean(asset.assetUrl && !asset.assetUrl.startsWith('data:image'));
  return (
    <article style={cardStyle()}>
      <div style={cardHeaderStyle()}>
        <h2 style={{ margin: 0 }}>镜头 {asset.shotNo || '-'} · 已存储图片</h2>
        <strong style={{ color: asset.status === 'done' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {asset.status.toUpperCase()}
        </strong>
      </div>
      {hasPreview && !loadFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`Storyboard image shot ${asset.shotNo || asset.sourceShotScriptId || ''}`}
          src={asset.assetUrl || ''}
          onError={() => setLoadFailed(true)}
          style={imagePreviewStyle()}
        />
      ) : (
        <div style={imageFallbackStyle()}>
          {loadFailed
            ? '图片资产已记录，但暂时无法读取。请刷新 signed URL 或检查 storage 文件。'
            : '图片资产缺少可预览 URL。'}
        </div>
      )}
      <div style={summaryGridStyle()}>
        <SummaryItem label="Provider" value={asset.imageProvider || '未记录'} />
        <SummaryItem label="Model" value={asset.imageModel || '未记录'} />
        <SummaryItem label="Storage key" value={asset.assetStorageKey || '未写入'} />
        <SummaryItem label="Generated at" value={asset.imageGeneratedAt || asset.generatedAt || '未记录'} />
      </div>
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 800 }}>查看图片资产详情</summary>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.9rem' }}>
          <InfoRow label="sourceShotScriptId" value={asset.sourceShotScriptId || '未绑定'} />
          <InfoRow label="assetUrl" value={asset.assetUrl || '未生成 signed URL'} />
          <InfoRow label="imagePrompt" value={asset.imagePrompt || '未记录'} />
          <InfoRow label="执行边界" value="已存储图片展示只读；不会调用图片模型、不会创建 worker/job、不会生成视频。" />
        </div>
      </details>
    </article>
  );
}

function StoryboardAssetCard({
  asset,
  existingImageAsset,
  onGenerateOne,
}: {
  asset: StoryboardAssetDTO;
  existingImageAsset: StoryboardAssetDTO | null;
  onGenerateOne: (asset: StoryboardAssetDTO) => void;
}) {
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => onGenerateOne(asset)}
          disabled={Boolean(existingImageAsset)}
          style={primaryButtonStyle(!existingImageAsset)}
        >
          {existingImageAsset ? '该镜头已有图片' : '生成该镜头图片'}
        </button>
        <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          单镜头确认入口；不会批量、不会视频、不会创建 worker/job。
        </span>
      </div>
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

function findImageAssetForTextBinding(
  textAsset: StoryboardAssetDTO,
  imageAssets: StoryboardAssetDTO[]
): StoryboardAssetDTO | null {
  const shotId = textAsset.sourceShotScriptId || textAsset.shotId;
  return (
    imageAssets.find((asset) => {
      const imageShotId = asset.sourceShotScriptId || asset.shotId;
      return Boolean(shotId && imageShotId === shotId);
    }) || null
  );
}

function isSingleShotConfirmed(confirmations: {
  cost: boolean;
  singleShot: boolean;
  noVideo: boolean;
  providerCall: boolean;
  noWorkerJob: boolean;
}) {
  return (
    confirmations.cost &&
    confirmations.singleShot &&
    confirmations.noVideo &&
    confirmations.providerCall &&
    confirmations.noWorkerJob
  );
}

function formatGenerateOneAcceptanceState(state: StoryboardImageGenerateOneDTO['acceptanceState']) {
  if (state === 'ready') return 'READY';
  if (state === 'blocked') return 'BLOCKED';
  if (state === 'provider_failed') return 'PROVIDER FAILED';
  if (state === 'storage_failed') return 'STORAGE FAILED';
  return 'ROLLBACK REQUIRED';
}

function describeGenerateOneAcceptanceState(state: StoryboardImageGenerateOneDTO['acceptanceState']) {
  if (state === 'ready') {
    return '单镜头图片资产已写入 metadata/storage；未创建 worker/job，未触发视频链路。';
  }
  if (state === 'blocked') {
    return '生成前置条件未满足，未调用 provider，未写入 metadata。';
  }
  if (state === 'provider_failed') {
    return 'provider 调用失败，未写入图片资产，可修复配置或提示词后重试。';
  }
  if (state === 'storage_failed') {
    return 'provider 已返回结果但 storage 持久化失败，metadata 未写入 ready 图片资产。';
  }
  return 'provider 已返回结果但 metadata 写入失败，需要人工确认外部资产残留后再重试。';
}

function ConfirmationCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={checkboxStyle()}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function calculateStoryboardMetrics(assets: StoryboardAssetDTO[]) {
  const textAssets = assets.filter((asset) => asset.status === 'done' && asset.assetKind === 'text_binding');
  const imageAssets = assets.filter((asset) => asset.status === 'done' && asset.assetKind === 'image');
  const promptCount = textAssets.filter((asset) => asset.prompt && asset.frameDescription && asset.cameraLanguage).length;
  const continuityCount = textAssets.filter((asset) => asset.continuityNotes.length > 0).length;
  return {
    textAssetCount: textAssets.length,
    imageAssetCount: imageAssets.length,
    shotCoverage: textAssets.length > 0 ? textAssets.length / textAssets.length : 0,
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

function secondaryButtonStyle(): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: '999px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0.75rem 1rem',
  };
}

function formGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    marginTop: '1rem',
  };
}

function fieldStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gap: '0.35rem',
  };
}

function fieldLabelStyle(): React.CSSProperties {
  return {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: 700,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--text-primary)',
    minHeight: '40px',
    padding: '0.6rem 0.7rem',
  };
}

function checkboxStyle(): React.CSSProperties {
  return {
    alignItems: 'flex-start',
    color: 'var(--text-secondary)',
    display: 'flex',
    gap: '0.6rem',
    lineHeight: 1.6,
    marginTop: '1rem',
  };
}

function dialogBackdropStyle(): React.CSSProperties {
  return {
    alignItems: 'center',
    background: 'rgba(15, 17, 21, 0.62)',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    padding: '1rem',
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 50,
  };
}

function dialogStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
    maxWidth: '680px',
    padding: '1.5rem',
    width: '100%',
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

function imagePreviewStyle(): React.CSSProperties {
  return {
    aspectRatio: '16 / 9',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    display: 'block',
    marginTop: '1rem',
    objectFit: 'cover',
    width: '100%',
  };
}

function imageFallbackStyle(): React.CSSProperties {
  return {
    alignItems: 'center',
    aspectRatio: '16 / 9',
    background: 'var(--bg-muted)',
    border: '1px dashed var(--border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-secondary)',
    display: 'flex',
    justifyContent: 'center',
    lineHeight: 1.6,
    marginTop: '1rem',
    padding: '1rem',
    textAlign: 'center',
  };
}
