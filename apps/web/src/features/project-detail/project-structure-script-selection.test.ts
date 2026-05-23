import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectStructureEpisodeNode } from '@scu/shared-types';
import {
  findFirstVideoScriptSelection,
  getScriptedSceneReferences,
} from './project-structure-script-selection';

function episodeWithScenes(): ProjectStructureEpisodeNode[] {
  return [
    {
      type: 'episode',
      id: 'episode-1',
      index: 1,
      name: '第一章',
      scenes: [
        {
          type: 'scene',
          id: 'scene-raw',
          index: 1,
          title: '原文素材场景',
          shots: [
            {
              type: 'shot',
              id: 'shot-raw',
              index: 1,
              content: '这里只是小说原文切片。',
              shotType: 'RAW',
            },
            {
              type: 'shot',
              id: 'shot-metadata',
              index: 2,
              content: '本书名称:表姑娘又又又又跑了',
              visualDescription: '场景《场景 1》的第 2 个镜头。画面重点：本书名称:表姑娘又又又又跑了',
              actionDescription: '本书名称:表姑娘又又又又跑了',
              shotType: 'SCRIPT',
            },
          ],
        },
      ],
    },
    {
      type: 'episode',
      id: 'episode-2',
      index: 2,
      name: '第二章',
      scenes: [
        {
          type: 'scene',
          id: 'scene-script',
          index: 1,
          title: '已生成剧本场景',
          shots: [
            {
              type: 'shot',
              id: 'shot-script',
              index: 1,
              visualDescription: '建立场景全景，主角进入画面。',
              actionDescription: '主角停下脚步，观察空间压力。',
              shotType: 'SCRIPT',
            },
          ],
        },
      ],
    },
  ];
}

test('findFirstVideoScriptSelection skips raw novel fragments and selects generated script scene', () => {
  assert.deepEqual(findFirstVideoScriptSelection(episodeWithScenes()), {
    episodeId: 'episode-2',
    sceneId: 'scene-script',
  });
});

test('getScriptedSceneReferences returns only scenes with video script fields', () => {
  const references = getScriptedSceneReferences(episodeWithScenes());

  assert.equal(references.length, 1);
  assert.equal(references[0].episode.id, 'episode-2');
  assert.equal(references[0].scene.id, 'scene-script');
  assert.equal(references[0].scriptedShots.length, 1);
});
