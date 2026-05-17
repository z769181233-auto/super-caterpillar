import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductionStateDTO } from '@scu/shared-types';
import { getRequiredEmptyStateLabels } from './studio-state-summary';

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
    },
    riskFlags: [],
  };

  assert.deepEqual(getRequiredEmptyStateLabels(state), [
    '故事圣经未生成',
    '角色资产未生成',
    '镜头台本未生成',
  ]);
});
