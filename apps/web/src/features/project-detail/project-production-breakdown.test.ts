import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectStructureEpisodeNode } from '@scu/shared-types';
import { deriveProductionBreakdown } from './project-production-breakdown';

function sampleEpisodes(): ProjectStructureEpisodeNode[] {
  return [
    {
      type: 'episode',
      id: 'episode-1',
      index: 1,
      name: '第一集',
      summary: '女主藏起律法书。',
      scenes: [
        {
          type: 'scene',
          id: 'scene-1',
          index: 1,
          title: '书房',
          summary: '薛知盈在书房翻查旧书，王嬷嬷突然出现。',
          characters: ['薛知盈', '王嬷嬷'],
          shots: [
            {
              type: 'shot',
              id: 'shot-1',
              index: 1,
              visualDescription: '书房内，薛知盈低头翻阅律法书。',
              actionDescription: '她把书藏进袖中。',
              resultImageUrl: 'storyboards/project/shot-1.png',
              content: '她翻开书。',
              shotType: 'MEDIUM',
            } as ProjectStructureEpisodeNode['scenes'][number]['shots'][number] & {
              resultImageUrl: string;
            },
            {
              type: 'shot',
              id: 'shot-2',
              index: 2,
              actionDescription: '王嬷嬷推门而入。',
              content: '门外脚步声逼近。',
              shotType: 'CLOSEUP',
            },
          ],
        },
      ],
    },
    {
      type: 'episode',
      id: 'episode-2',
      index: 2,
      name: '第二集',
      scenes: [
        {
          type: 'scene',
          id: 'scene-2',
          index: 1,
          title: '庭院',
          characters: '薛知盈、萧昀祈',
          shots: [
            {
              type: 'shot',
              id: 'shot-3',
              index: 1,
              content: '二人在庭院相遇。',
              shotType: 'WIDE',
            },
          ],
        },
      ],
    },
  ];
}

test('deriveProductionBreakdown builds character design cards from scene characters', () => {
  const result = deriveProductionBreakdown(sampleEpisodes());
  const xue = result.characterCards.find((card) => card.name === '薛知盈');

  assert.ok(xue);
  assert.equal(xue.episodeCount, 2);
  assert.equal(xue.sceneCount, 2);
  assert.equal(xue.firstAppearance, '第 1 集 / 场景 1');
  assert.match(xue.visualReference, /书房内/);
  assert.match(xue.costumeAndProps, /书/);
});

test('deriveProductionBreakdown builds episode boards with read-only shot statuses', () => {
  const result = deriveProductionBreakdown(sampleEpisodes());
  const firstEpisode = result.episodeBoards[0];

  assert.equal(firstEpisode.sceneCount, 1);
  assert.equal(firstEpisode.shotCount, 2);
  assert.equal(firstEpisode.scriptedShotCount, 2);
  assert.equal(firstEpisode.imageAssetCount, 1);
  assert.equal(firstEpisode.scenes[0].shots[0].status, 'IMAGE_ASSET');
  assert.equal(firstEpisode.scenes[0].shots[1].status, 'TEXT_SCRIPT');
  assert.equal(result.episodeBoards[1].scenes[0].shots[0].status, 'PENDING');
});
