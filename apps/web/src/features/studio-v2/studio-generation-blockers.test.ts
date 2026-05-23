import assert from 'node:assert/strict';
import type { ProductionStateDTO, ShotScriptQualityGateDTO } from '@scu/shared-types';
import {
  formatStudioGenerationError,
  getShotScriptGenerationGate,
} from './studio-generation-blockers';

function stateWithGate(gate: ShotScriptQualityGateDTO): ProductionStateDTO {
  return {
    projectId: 'project-1',
    currentStage: 'shot_script_ready',
    stages: [],
    missingCapabilities: [],
    nextActions: [],
    legacyDataSummary: {
      projectName: 'Demo',
      hasStorySource: false,
      storySourceCount: 0,
      hasNovelSource: false,
      novelTitle: null,
      novelFileName: null,
      novelChapterCount: 0,
      episodeCount: 0,
      sceneCount: 0,
      shotCount: 0,
      storyboardImageCount: 0,
      videoJobCount: 0,
      qualityScoreCount: 0,
    },
    shotScriptQualityGate: gate,
    riskFlags: [],
  };
}

const baseGate: ShotScriptQualityGateDTO = {
  status: 'passed',
  source: 'studio_director_scripts',
  candidateShotCount: 4,
  minShotCount: 4,
  dialogueExtractionRate: 0.5,
  minDialogueExtractionRate: 0.5,
  characterBindingRate: 1,
  minCharacterBindingRate: 1,
  locationBindingRate: 1,
  minLocationBindingRate: 1,
  evidenceBindingRate: 1,
  minEvidenceBindingRate: 1,
  hasPlaceholderText: false,
  reasons: [],
  nextAction: null,
  checkedAt: '2026-05-23T00:00:00.000Z',
};

const episodePlanBlocker = formatStudioGenerationError(
  'No usable scene candidates found for EpisodePlan generation.\nRequired threshold: at least 1 usable medium/high scene candidate per chapter.',
  '剧集规划'
);

assert.match(episodePlanBlocker, /小说分析质量门禁阻断/);
assert.match(episodePlanBlocker, /不是页面卡住/);
assert.match(episodePlanBlocker, /章节拆分、人物抽取、场景抽取、对白块、动作块和 scene candidates/);

const directorBlocker = formatStudioGenerationError(
  'No stable scene candidate evidence found for DirectorScript generation.\nRequired evidence: scene-candidate id, confidence, sourceBlocks, text, characters, and at least one location/dialogue/action trace.',
  '导演剧本'
);

assert.match(directorBlocker, /导演剧本已被小说分析质量门禁阻断/);

const shotScriptQualityBlocker = formatStudioGenerationError(
  'ShotScript text quality gate failed.\nQuality problems: shot_count 2/4; dialogue_extraction_rate 0%/50%; evidence_binding_rate 75%/100%.',
  '镜头台本'
);

assert.match(shotScriptQualityBlocker, /镜头台本已被镜头台本文本质量门槛阻断/);
assert.match(shotScriptQualityBlocker, /镜头数不足、对白抽取不足、角色\/场景\/source evidence 未完整绑定/);
assert.match(shotScriptQualityBlocker, /修复 sceneCandidates、对白\/动作块抽取、CharacterBible 和 LocationBible/);

const unrelatedError = formatStudioGenerationError('Unauthorized', '剧集规划');
assert.equal(unrelatedError, 'Unauthorized');

assert.deepEqual(getShotScriptGenerationGate(stateWithGate(baseGate), false), {
  canGenerate: true,
  reason: null,
});

const blockedGateResult = getShotScriptGenerationGate(
  stateWithGate({
    ...baseGate,
    status: 'blocked',
    candidateShotCount: 2,
    reasons: ['镜头候选数不足：2/4', '对白抽取率不足：0%/50%'],
    nextAction: '修复 sceneCandidates 后重试。',
  }),
  false
);
assert.equal(blockedGateResult.canGenerate, false);
assert.match(blockedGateResult.reason || '', /镜头台本文本质量门槛未通过/);
assert.match(blockedGateResult.reason || '', /镜头候选数不足：2\/4/);

const prerequisiteGateResult = getShotScriptGenerationGate(
  stateWithGate({
    ...baseGate,
    status: 'prerequisite_missing',
    source: 'none',
    candidateShotCount: 0,
    dialogueExtractionRate: null,
    characterBindingRate: null,
    locationBindingRate: null,
    evidenceBindingRate: null,
    reasons: ['DirectorScript 未生成，无法预检镜头台本文本质量。'],
    nextAction: '先生成 DirectorScript。',
  }),
  false
);
assert.equal(prerequisiteGateResult.canGenerate, false);
assert.match(prerequisiteGateResult.reason || '', /前置条件未满足/);

assert.deepEqual(
  getShotScriptGenerationGate(stateWithGate({ ...baseGate, status: 'blocked' }), true),
  {
    canGenerate: true,
    reason: null,
  }
);

console.log('studio-generation-blockers tests passed');
