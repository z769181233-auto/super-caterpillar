import type { ProductionStateDTO } from '@scu/shared-types';

const SCENE_CANDIDATE_BLOCKER_PATTERNS = [
  /No usable scene candidates found/i,
  /usable scene candidates below threshold/i,
  /coverageReport\.sceneCandidates/i,
  /scene candidate evidence/i,
];

const SHOT_SCRIPT_QUALITY_GATE_PATTERNS = [
  /ShotScript text quality gate failed/i,
  /shot_count \d+\/\d+/i,
  /dialogue_extraction_rate \d+%\/\d+%/i,
  /character_binding_rate \d+%\/\d+%/i,
  /location_binding_rate \d+%\/\d+%/i,
  /evidence_binding_rate \d+%\/\d+%/i,
  /evidence_coverage_rate \d+%\/\d+%/i,
  /continuity_coverage_rate \d+%\/\d+%/i,
  /overall_quality_score \d+\/\d+/i,
  /placeholder_text_in_shots/i,
];

export interface StudioGenerationGateResult {
  canGenerate: boolean;
  reason: string | null;
}

export function getShotScriptGenerationGate(
  state: ProductionStateDTO | null,
  hasExistingShotScripts: boolean
): StudioGenerationGateResult {
  if (hasExistingShotScripts) return { canGenerate: true, reason: null };
  if (!state) {
    return {
      canGenerate: false,
      reason: '正在读取生产状态，暂不能生成镜头台本。',
    };
  }

  const gate = state.shotScriptQualityGate;
  if (gate.status === 'passed') return { canGenerate: true, reason: null };

  const reasons = gate.reasons.length > 0 ? gate.reasons.join('；') : null;
  const nextAction = gate.nextAction ? `下一步：${gate.nextAction}` : null;

  if (gate.status === 'blocked') {
    return {
      canGenerate: false,
      reason: [
        '镜头台本文本质量门槛未通过，暂不能生成镜头台本。',
        reasons ? `原因：${reasons}` : null,
        nextAction,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (gate.status === 'prerequisite_missing') {
    return {
      canGenerate: false,
      reason: [
        '镜头台本前置条件未满足，暂不能生成镜头台本。',
        reasons ? `原因：${reasons}` : null,
        nextAction,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  return {
    canGenerate: false,
    reason: [
      '镜头台本文本质量门槛尚未完成评估，暂不能生成镜头台本。',
      nextAction,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function getStoryboardAssetGenerationGate(
  state: ProductionStateDTO | null,
  hasExistingStoryboardAssets: boolean
): StudioGenerationGateResult {
  if (hasExistingStoryboardAssets) return { canGenerate: true, reason: null };
  if (!state) {
    return {
      canGenerate: false,
      reason: '正在读取生产状态，暂不能生成 StoryboardAsset 文本绑定。',
    };
  }

  const shotScriptStage = state.stages.find((stage) => stage.key === 'shot_script_ready');
  if (shotScriptStage?.status === 'done') {
    return { canGenerate: true, reason: null };
  }

  return {
    canGenerate: false,
    reason: [
      'StoryboardAsset 需要先完成 ready 状态的 ShotScript。',
      shotScriptStage?.missingReason ? `原因：${shotScriptStage.missingReason}` : null,
      shotScriptStage?.nextAction ? `下一步：${shotScriptStage.nextAction}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function formatStudioGenerationError(errorMessage: string, targetLabel: string): string {
  const normalized = errorMessage.trim();
  if (!normalized) {
    return `${targetLabel}生成失败，但接口没有返回错误详情。`;
  }

  const isShotScriptQualityGateBlocker = SHOT_SCRIPT_QUALITY_GATE_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
  if (isShotScriptQualityGateBlocker) {
    return [
      `${targetLabel}已被镜头台本文本质量门槛阻断，不是页面卡住。`,
      '原因：当前候选镜头还不满足写入标准，可能存在镜头数不足、必填字段不完整、source evidence/continuity notes 覆盖不足、质量分不足，或占位/旧摘要文本泄漏。',
      '下一步：修复 DirectorScript scene beats、sceneCandidates、source evidence、CharacterBible 和 LocationBible 后，再重新生成镜头台本。',
      '原始接口原因：',
      normalized,
    ].join('\n');
  }

  const isSceneCandidateBlocker = SCENE_CANDIDATE_BLOCKER_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
  if (!isSceneCandidateBlocker) return normalized;

  return [
    `${targetLabel}已被小说分析质量门禁阻断，不是页面卡住。`,
    '原因：当前小说分析结果缺少可追踪的中/高置信度 scene candidates，不能继续把章节摘要或旧数据伪装成正式 Studio 产物。',
    '下一步：回到小说分析质量链路，补足章节拆分、人物抽取、场景抽取、对白块、动作块和 scene candidates 后再重试。',
    '原始接口原因：',
    normalized,
  ].join('\n');
}
