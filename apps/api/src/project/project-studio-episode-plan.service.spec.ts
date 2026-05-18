import { BadRequestException } from '@nestjs/common';
import { ProjectStudioEpisodePlanService } from './project-studio-episode-plan.service';

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
    episode: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    sceneDraft: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

const sceneCandidate = {
  candidateId: 'chapter-1:scene-candidate:1',
  index: 1,
  source: 'paragraph',
  text: '薛知盈在静水院偷读律法书，王嬷嬷忽然来查，春桃守在门外。',
  characters: ['薛知盈', '王嬷嬷', '春桃'],
  location: '静水院',
  timeOfDay: '午后',
  emotionalTone: '压抑',
  conflictSummary: '秘密读书与家族规训冲突',
  dialogueBlockIndexes: [1, 2, 3],
  actionBlockIndexes: [1, 2, 3],
  sourceBlockIndexes: [1],
  confidence: 'high',
  traceReason: '人物、地点、对白、动作同时命中',
};

describe('ProjectStudioEpisodePlanService', () => {
  it('returns a missing EpisodePlan DTO when metadata has no episode plans', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.getEpisodePlans('project-1', 'org-1');

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0].status).toBe('missing');
    expect(episodePlans[0].missingReason).toBe('剧集规划未生成');
  });

  it('generates deterministic EpisodePlan records from legacy novel chapters', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '表姑娘又又又又跑了',
          metadata: {
            animationStudio: {
              characterBibles: [
                { id: 'character-1', name: '薛知盈', status: 'done' },
                { id: 'character-2', name: '王嬷嬷', status: 'done' },
              ],
              locationBibles: [
                { id: 'location-1', name: '静水院', status: 'done' },
                { id: 'location-2', name: '云墨斋', status: 'done' },
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
              id: 'chapter-1',
              index: 1,
              title: '第一章',
              summary: '薛知盈在静水院偷读律法书，王嬷嬷忽然来查。',
              rawContent: '春桃守在门外，云墨斋里仍留着旧书和墨砚。',
            },
          ],
        }),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            chapterId: 'chapter-1',
            analysisResult: {
              coverageReport: {
                qualityGate: { status: 'pass' },
                sceneCandidates: [sceneCandidate],
              },
            },
          },
        ]),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0]).toEqual(
      expect.objectContaining({
        episodeNo: 1,
        title: '第 1 集：第一章',
        status: 'done',
        version: 'studio-episode-plan-v1',
        productionStatus: 'draft',
      })
    );
    expect(episodePlans[0].appearingCharacterNames).toEqual(
      expect.arrayContaining(['薛知盈', '王嬷嬷'])
    );
    expect(episodePlans[0].appearingLocationNames).toEqual(expect.arrayContaining(['静水院']));
    expect(episodePlans[0].coolPoints.length).toBeGreaterThan(0);
    expect(episodePlans[0].plotGoal).toContain('薛知盈在静水院');
    expect(episodePlans[0].sourceEvidence.join('\n')).toContain('scene-candidate:chapter-1:scene-candidate:1');
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              episodePlans: expect.arrayContaining([
                expect.objectContaining({
                  episodeNo: 1,
                  status: 'done',
                  version: 'studio-episode-plan-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('generates EpisodePlan records from legacy episodes without replacing old episode APIs', async () => {
    const prisma = createPrismaMock({
      episode: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'episode-1',
            index: 1,
            name: '第一集',
            summary: '薛知盈在静水院被王嬷嬷盘问。',
            status: 'ready',
            _count: { scenes: 4 },
          },
        ]),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans[0].episodeId).toBe('episode-1');
    expect(episodePlans[0].title).toBe('第一集');
    expect(episodePlans[0].plotGoal).toContain('静水院');
  });

  it('prefers coverageReport scene candidates over legacy episodes when novel chapters exist', async () => {
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
              id: 'chapter-1',
              index: 1,
              title: '第一章',
              summary: '旧摘要不应优先。',
              rawContent: '旧正文。',
            },
          ],
        }),
      },
      episode: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'legacy-episode-1',
            index: 1,
            name: '旧结构第一集',
            summary: '旧结构摘要不能覆盖 scene candidate。',
            status: 'ready',
            _count: { scenes: 4 },
          },
        ]),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            chapterId: 'chapter-1',
            analysisResult: {
              coverageReport: {
                qualityGate: { status: 'pass' },
                sceneCandidates: [sceneCandidate],
              },
            },
          },
        ]),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0].episodeId).toBeNull();
    expect(episodePlans[0].title).toBe('第 1 集：第一章');
    expect(episodePlans[0].sourceEvidence.join('\n')).toContain(
      'scene-candidate:chapter-1:scene-candidate:1'
    );
    expect(episodePlans[0].plotGoal).not.toContain('旧结构摘要不能覆盖');
  });

  it('blocks EpisodePlan generation from novel chapters when scene candidates are missing', async () => {
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
              id: 'chapter-1',
              index: 1,
              title: '第一章',
              summary: '只有旧摘要，没有可追踪 scene candidate。',
              rawContent: '旧正文。',
            },
          ],
        }),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            chapterId: 'chapter-1',
            analysisResult: {
              coverageReport: {
                qualityGate: { status: 'blocked' },
                sceneCandidates: [],
              },
            },
          },
        ]),
      },
      episode: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'legacy-episode-1',
            index: 1,
            name: '旧结构第一集',
            summary: '不应在 scene candidate 缺失时回退。',
            status: 'ready',
            _count: { scenes: 4 },
          },
        ]),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    await expect(service.generateEpisodePlans('project-1', 'org-1')).rejects.toThrow(
      /No usable scene candidates found for EpisodePlan generation/
    );
    await expect(service.generateEpisodePlans('project-1', 'org-1')).rejects.toThrow(/quality gate blocked/);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('explains the coverage shortage when scene candidates are below the usable threshold', async () => {
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
              id: 'chapter-1',
              index: 1,
              title: '第一章',
              summary: '只有低置信度候选。',
              rawContent: '旧正文。',
            },
          ],
        }),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            chapterId: 'chapter-1',
            analysisResult: {
              coverageReport: {
                sceneCandidateCount: 1,
                characterCount: 0,
                locationCount: 0,
                dialogueBlockCount: 0,
                actionBlockCount: 0,
                missingCapabilities: ['character_extraction', 'location_extraction'],
                qualityGate: {
                  status: 'warning',
                  warnings: ['low_character_coverage'],
                  nextActions: ['rerun scene candidate extraction'],
                },
                sceneCandidates: [
                  {
                    ...sceneCandidate,
                    candidateId: 'chapter-1:scene-candidate:low',
                    confidence: 'low',
                  },
                ],
              },
            },
          },
        ]),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    await expect(service.generateEpisodePlans('project-1', 'org-1')).rejects.toThrow(
      /usable scene candidates below threshold/
    );
    await expect(service.generateEpisodePlans('project-1', 'org-1')).rejects.toThrow(
      /missing:character_extraction/
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('does not generate EpisodePlan when no story, novel, chapter, or episode source exists', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    await expect(service.generateEpisodePlans('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
