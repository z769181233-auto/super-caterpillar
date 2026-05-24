import type { ProductionStateDTO, ProductionStageDTO } from '@scu/shared-types';

const TEXT_PIPELINE_STAGE_KEYS = [
  'story_bible_ready',
  'episodes_ready',
  'director_script_ready',
  'shot_script_ready',
] as const;

export function getDoneStages(state: ProductionStateDTO): ProductionStageDTO[] {
  return state.stages.filter((stage) => stage.status === 'done');
}

export function getMissingOrBlockedStages(state: ProductionStateDTO): ProductionStageDTO[] {
  return state.stages.filter(
    (stage) => stage.status === 'missing' || stage.status === 'blocked' || stage.status === 'failed'
  );
}

export function getRequiredEmptyStateLabels(state: ProductionStateDTO): string[] {
  const requiredKeys = new Set([...TEXT_PIPELINE_STAGE_KEYS, 'characters_ready', 'locations_ready']);
  return state.stages
    .filter((stage) => requiredKeys.has(stage.key))
    .filter((stage) => stage.status !== 'done')
    .map((stage) => stage.missingReason || `${stage.label}未生成`);
}

export function getTextPipelineStages(state: ProductionStateDTO): ProductionStageDTO[] {
  return TEXT_PIPELINE_STAGE_KEYS.map(
    (key) => state.stages.find((stage) => stage.key === key)
  ).filter(Boolean) as ProductionStageDTO[];
}

export function isTextPipelineReady(state: ProductionStateDTO): boolean {
  return getTextPipelineStages(state).every((stage) => stage.status === 'done');
}

export function getFirstTextPipelineBlocker(state: ProductionStateDTO): ProductionStageDTO | null {
  return (
    getTextPipelineStages(state).find(
      (stage) => stage.status === 'missing' || stage.status === 'blocked' || stage.status === 'failed'
    ) || null
  );
}

export function formatTextPipelineSummary(state: ProductionStateDTO): string[] {
  const textStages = getTextPipelineStages(state);
  const firstBlocker = getFirstTextPipelineBlocker(state);
  const storyboardStage = state.stages.find((stage) => stage.key === 'storyboard_ready');
  const videoPromptStage = state.stages.find((stage) => stage.key === 'video_prompt_ready');

  return [
    `文本链路：${isTextPipelineReady(state) ? '已完成' : '未完成'}`,
    ...textStages.map((stage) => `${stage.label}：${stage.status}`),
    `最早阻断：${firstBlocker ? `${firstBlocker.label} - ${firstBlocker.missingReason || firstBlocker.status}` : '无'}`,
    `下一步：${firstBlocker?.nextAction || '文本链路已到 ShotScript；下一阶段仍需方案设计'}`,
    `Storyboard：${storyboardStage?.status || '未知'}（ShotScript ready 不会自动生成）`,
    `VideoPrompt：${videoPromptStage?.status || '未知'}（ShotScript video_prompt 只是文本草案）`,
  ];
}

export function formatLegacySummary(state: ProductionStateDTO): string[] {
  const legacy = state.legacyDataSummary;
  const coverage = legacy.sceneCandidateCoverage;
  return [
    `StorySource：${legacy.storySourceCount}`,
    `旧小说来源：${legacy.hasNovelSource ? '有' : '无'}`,
    `章节：${legacy.novelChapterCount}`,
    coverage
      ? `场景候选：${coverage.usableSceneCandidateCount}/${Math.max(1, coverage.chapterCount)} 可用`
      : '场景候选：未知',
    `旧剧集：${legacy.episodeCount}`,
    `旧场景：${legacy.sceneCount}`,
    `旧镜头：${legacy.shotCount}`,
    `旧分镜/图片：${legacy.storyboardImageCount}`,
    `旧视频任务：${legacy.videoJobCount}`,
    `旧质量评分：${legacy.qualityScoreCount}`,
  ];
}

export function formatSceneCandidateCoverage(state: ProductionStateDTO): string[] {
  const coverage = state.legacyDataSummary.sceneCandidateCoverage;
  if (!coverage) {
    return ['场景候选覆盖率：未知'];
  }

  return [
    `状态：${coverage.coverageStatus}`,
    `SceneDraft：${coverage.sceneDraftCount}`,
    `CoverageReport：${coverage.coverageReportCount}`,
    `场景候选：${coverage.sceneCandidateCount}`,
    `可用场景候选：${coverage.usableSceneCandidateCount}/${Math.max(1, coverage.chapterCount)}`,
    `质量门禁：${coverage.qualityGateStatus || '未知'}${coverage.qualityGateScore === null ? '' : ` (${coverage.qualityGateScore})`}`,
    `缺失能力：${coverage.missingCapabilities.length ? coverage.missingCapabilities.join('、') : '无'}`,
    `阻断原因：${coverage.blockerReason || '无'}`,
  ];
}

function formatPercent(value: number | null): string {
  return value === null ? '未评估' : `${Math.round(value * 100)}%`;
}

export function formatShotScriptQualityGate(state: ProductionStateDTO): string[] {
  const gate = state.shotScriptQualityGate;
  return [
    `状态：${gate.status}`,
    `来源：${gate.source}`,
    `镜头候选数：${gate.candidateShotCount}/${gate.minShotCount}`,
    `对白抽取率：${formatPercent(gate.dialogueExtractionRate)}/${formatPercent(gate.minDialogueExtractionRate)}`,
    `角色绑定率：${formatPercent(gate.characterBindingRate)}/${formatPercent(gate.minCharacterBindingRate)}`,
    `场景绑定率：${formatPercent(gate.locationBindingRate)}/${formatPercent(gate.minLocationBindingRate)}`,
    `证据绑定率：${formatPercent(gate.evidenceBindingRate)}/${formatPercent(gate.minEvidenceBindingRate)}`,
    `连续性备注：Phase 1B-C 要求 >= 80%，详情见 ShotScript 卡片`,
    `占位文本：${gate.hasPlaceholderText ? '存在' : '未发现'}`,
    `阻断原因：${gate.reasons.length ? gate.reasons.join('；') : '无'}`,
    `下一步：${gate.nextAction || '无'}`,
  ];
}
