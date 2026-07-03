import { BadRequestException } from '@nestjs/common';
import {
  ProjectStudioLocationBibleService,
  validateLocationBibleQuality,
} from './project-studio-location-bible.service';

function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: '表姑娘又又又又跑了',
        metadata: {},
      }),
      update: jest.fn().mockResolvedValue({ id: 'project-1' }),
    },
    storySource: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    novelSource: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    novel: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    scene: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('ProjectStudioLocationBibleService', () => {
  it('returns a missing LocationBible DTO when metadata has no location bibles', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioLocationBibleService(prisma as any);

    const locations = await service.getLocationBibles('project-1', 'org-1');

    expect(locations).toHaveLength(1);
    expect(locations[0].status).toBe('missing');
    expect(locations[0].missingReason).toBe('场景资产未生成');
  });

  it('generates deterministic LocationBible records from legacy novel chapters and scenes', async () => {
    const prisma = createPrismaMock({
      novelSource: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-source-1',
          fileName: '表姑娘又又又又跑了.txt',
        }),
      },
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          chapters: [
            {
              index: 1,
              title: '第一章',
              summary: '薛知盈在静水院偷读律法书，王嬷嬷忽然来查。',
              rawContent: '春桃守在门外，云墨斋里仍留着旧书和墨砚。',
            },
          ],
        }),
      },
      scene: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'scene-1',
            title: '静水院书房',
            summary: '窗下藏书，院中安静。',
            enrichedText: '静水院内，薛知盈把律法书藏进抽屉。',
            locationSlug: '静水院',
            timeOfDay: '午后',
            environmentTags: ['宅院', '书房'],
          },
        ]),
      },
    });
    const service = new ProjectStudioLocationBibleService(prisma as any);

    const locations = await service.generateLocationBibles('project-1', 'org-1');

    expect(locations.map((location) => location.name)).toEqual(
      expect.arrayContaining(['静水院', '云墨斋'])
    );
    expect(locations.find((location) => location.name === '静水院')?.visualPrompt).toContain(
      '静水院'
    );
    expect(locations.every((location) => location.assetIds.length === 0)).toBe(true);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              locationBibles: expect.arrayContaining([
                expect.objectContaining({
                  name: '静水院',
                  status: 'done',
                  version: 'studio-location-bible-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('binds generated LocationBible records to ready ShotScript locations', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '表姑娘又又又又跑了',
          metadata: {
            animationStudio: {
              shotScripts: [
                {
                  shot_id: 'shot-script-1',
                  status: 'ready',
                  location_id: 'location-1',
                  scene_id: 'episode-1:scene-1',
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
      novelSource: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-source-1',
          fileName: '表姑娘又又又又跑了.txt',
        }),
      },
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          chapters: [
            {
              index: 1,
              title: '第一章',
              summary: '薛知盈在静水院偷读律法书。',
              rawContent: '云墨斋里仍留着旧书和墨砚。',
            },
          ],
        }),
      },
    });
    const service = new ProjectStudioLocationBibleService(prisma as any);

    const locations = await service.generateLocationBibles('project-1', 'org-1');

    expect(locations.find((location) => location.locationId === 'location-1')?.linkedShotIds).toContain(
      'shot-script-1'
    );
    expect(locations.every((location) => location.assetIds.length === 0)).toBe(true);
  });

  it('blocks LocationBible quality when ShotScript locations are not covered', () => {
    const result = validateLocationBibleQuality(
      [
        {
          status: 'done',
          locationId: 'location-1',
          name: '静水院',
          functionRole: '宅院空间',
          architectureStyle: '古风宅院',
          lightingMood: '窗侧柔光',
          visualPrompt: '静水院场景设定',
          sourceEvidence: ['source'],
          linkedShotIds: [],
          assetIds: [],
        },
      ],
      [{ shot_id: 'shot-script-1', status: 'ready', location_id: 'location-2' }],
      [{ status: 'done', locationId: 'location-2' }],
      { status: 'ready' }
    );

    expect(result.passed).toBe(false);
    expect(result.blockers.join('\n')).toContain('ShotScript 地点覆盖率不足');
  });

  it('does not generate LocationBible when no story, novel, or scene source exists', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioLocationBibleService(prisma as any);

    await expect(service.generateLocationBibles('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
