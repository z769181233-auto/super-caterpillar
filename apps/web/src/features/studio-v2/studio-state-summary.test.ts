import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductionStateDTO } from '@scu/shared-types';
import {
  formatSceneCandidateCoverage,
  formatShotScriptQualityGate,
  getRequiredEmptyStateLabels,
} from './studio-state-summary';

test('Studio empty-state summary does not treat missing core assets as generated', () => {
  const state: ProductionStateDTO = {
    projectId: 'project-1',
    currentStage: 'story_bible_ready',
    stages: [
      {
        key: 'story_bible_ready',
        label: '故事圣经',
        status: 'missing',
        evidence: [],
        missingReason: '故事圣经未生成',
        nextAction: 'Phase 2 生成 StoryBible',
      },
      {
        key: 'characters_ready',
        label: '角色资产',
        status: 'missing',
        evidence: [],
        missingReason: '角色资产未生成',
        nextAction: 'Phase 2 生成角色资产',
      },
      {
        key: 'shot_script_ready',
        label: '镜头台本',
        status: 'missing',
        evidence: [],
        missingReason: '镜头台本未生成',
        nextAction: 'Phase 2 生成标准镜头台本',
      },
    ],
    missingCapabilities: ['故事圣经', '角色资产', '镜头台本'],
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
      sceneCandidateCoverage: {
        sceneDraftCount: 1,
        coverageReportCount: 1,
        sceneCandidateCount: 1,
        usableSceneCandidateCount: 0,
        chapterCount: 1,
        coverageStatus: 'insufficient',
        qualityGateStatus: 'blocked',
        qualityGateScore: 35,
        missingCapabilities: ['locations'],
        blockerReason: '可用 scene candidates 不足：0/1。',
        nextAction: '补足章节到 scene candidate 的可追踪映射后再重试。',
      },
    },
    shotScriptQualityGate: {
      status: 'blocked',
      source: 'studio_director_scripts',
      candidateShotCount: 2,
      minShotCount: 4,
      dialogueExtractionRate: 0.25,
      minDialogueExtractionRate: 0.5,
      characterBindingRate: 1,
      minCharacterBindingRate: 1,
      locationBindingRate: 0.5,
      minLocationBindingRate: 1,
      evidenceBindingRate: 1,
      minEvidenceBindingRate: 1,
      hasPlaceholderText: false,
      reasons: ['镜头候选数不足：2/4', '场景绑定率不足：50%/100%'],
      nextAction: '修复 sceneCandidates 后重试。',
      checkedAt: '2026-05-23T00:00:00.000Z',
    },
    riskFlags: [],
  };

  assert.deepEqual(getRequiredEmptyStateLabels(state), [
    '故事圣经未生成',
    '角色资产未生成',
    '镜头台本未生成',
  ]);
  assert.deepEqual(formatSceneCandidateCoverage(state), [
    '状态：insufficient',
    'SceneDraft：1',
    'CoverageReport：1',
    '场景候选：1',
    '可用场景候选：0/1',
    '质量门禁：blocked (35)',
    '缺失能力：locations',
    '阻断原因：可用 scene candidates 不足：0/1。',
  ]);
  assert.deepEqual(formatShotScriptQualityGate(state), [
    '状态：blocked',
    '来源：studio_director_scripts',
    '镜头候选数：2/4',
    '对白抽取率：25%/50%',
    '角色绑定率：100%/100%',
    '场景绑定率：50%/100%',
    '证据绑定率：100%/100%',
    '连续性备注：Phase 1B-C 要求 >= 80%，详情见 ShotScript 卡片',
    '占位文本：未发现',
    '阻断原因：镜头候选数不足：2/4；场景绑定率不足：50%/100%',
    '下一步：修复 sceneCandidates 后重试。',
  ]);
});
