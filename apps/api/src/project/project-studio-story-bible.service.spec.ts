import {
  ProjectStudioStoryBibleService,
  validateStoryBibleQuality,
} from './project-studio-story-bible.service';

function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: '表姑娘又又又又跑了',
        description: null,
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
    sceneDraft: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('ProjectStudioStoryBibleService', () => {
  it('returns a missing StoryBible DTO when metadata has no Studio story bible', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioStoryBibleService(prisma as any);

    const storyBible = await service.getStoryBible('project-1', 'org-1');

    expect(storyBible.status).toBe('missing');
    expect(storyBible.title).toBeNull();
    expect(storyBible.missingReason).toBe('故事圣经未生成');
  });

  it('generates a deterministic StoryBible from legacy novel chapters and persists it in project metadata', async () => {
    const prisma = createPrismaMock({
      novelSource: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-source-1',
          fileName: '表姑娘又又又又跑了.txt',
          totalChapters: 59,
          rawText: '薛知盈在静水院藏起律法书，王嬷嬷逼近院门，萧昀祈回府。',
        }),
      },
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          author: '狗柱',
          fileName: '表姑娘又又又又跑了.txt',
          chapterCount: 59,
          chapters: [
            {
              index: 1,
              title: '第一章',
              summary: '薛知盈在静水院偷读律法书，王嬷嬷忽然来查。',
              rawContent: '薛知盈把书藏进抽屉，听闻大公子回府。',
            },
            {
              index: 2,
              title: '第二章',
              summary: '萧昀祈回府，家族关系开始收紧。',
              rawContent: null,
            },
          ],
        }),
      },
    });
    const service = new ProjectStudioStoryBibleService(prisma as any);

    const storyBible = await service.generateStoryBible('project-1', 'org-1');

    expect(storyBible.status).toBe('ready');
    expect(storyBible.title).toBe('表姑娘又又又又跑了');
    expect(storyBible.logline).toContain('薛知盈');
    expect(storyBible.genre).toContain('古风');
    expect(storyBible.theme).toBeTruthy();
    expect(storyBible.tone).toBeTruthy();
    expect(storyBible.main_characters?.length).toBeGreaterThanOrEqual(2);
    expect(storyBible.story_world?.core_locations.length).toBeGreaterThanOrEqual(1);
    expect(storyBible.source_evidence?.length).toBeGreaterThanOrEqual(3);
    expect(storyBible.quality_score).toBeGreaterThanOrEqual(70);
    expect(storyBible.sourceEvidence).toEqual(
      expect.arrayContaining(['Novel:novel-1', 'NovelSource:novel-source-1', 'chapterCount:59'])
    );
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              storyBible: expect.objectContaining({
                status: 'ready',
                version: 'studio-story-bible-v1',
              }),
            }),
          }),
        },
      })
    );
  });

  it('does not generate StoryBible when no StorySource or legacy novel source exists', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioStoryBibleService(prisma as any);

    const storyBible = await service.generateStoryBible('project-1', 'org-1');

    expect(storyBible.status).toBe('blocked');
    expect(storyBible.blockers?.join('\n')).toContain('缺少 StorySource 或 NovelSource compatibility');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks StoryBible generation when source evidence is insufficient', async () => {
    const prisma = createPrismaMock({
      novelSource: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-source-1',
          fileName: 'thin.txt',
          totalChapters: 0,
          rawText: null,
        }),
      },
    });
    const service = new ProjectStudioStoryBibleService(prisma as any);

    const storyBible = await service.generateStoryBible('project-1', 'org-1');

    expect(storyBible.status).toBe('blocked');
    expect(storyBible.source_evidence?.length).toBeLessThan(3);
    expect(storyBible.blockers).toEqual(expect.arrayContaining(['source_evidence 少于 3 条。']));
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('validates StoryBible field completeness and quality gate', () => {
    expect(
      validateStoryBibleQuality({
        id: 'story-bible-1',
        projectId: 'project-1',
        source_type: 'legacy_novel_source',
        status: 'ready',
        title: '表姑娘又又又又跑了',
        genre: '古风',
        worldview: '宅院关系世界',
        mainConflict: '秘密与家族压力',
        emotionalArc: '从躲避到选择',
        characterRelationship: '薛知盈与萧昀祈被家族关系牵引',
        longTermForeshadowing: [],
        visualStyle: '古风动画',
        targetPlatform: '短剧动漫',
        adaptationStrategy: '先故事圣经后镜头台本',
        audienceHook: '秘密被发现',
        sourceSummary: '薛知盈在静水院藏书。',
        sourceEvidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'chapterCount:59'],
        source_evidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'chapterCount:59'],
        logline: '薛知盈在静水院藏起秘密，家族压力逼近。',
        theme: '身份秩序下的自我选择',
        tone: '克制、悬念、关系张力',
        story_world: {
          setting: '古代宅院',
          time_period: '架空古风',
          core_locations: [{ location_id: 'location-1', name: '静水院', description: '核心院落' }],
        },
        main_characters: [
          {
            character_id: 'character-1',
            name: '薛知盈',
            role: '主角',
            motivation: '守住秘密',
            conflict: '家族压力',
          },
          {
            character_id: 'character-2',
            name: '萧昀祈',
            role: '关键关系角色',
            motivation: '推动关系',
            conflict: '立场不明',
          },
        ],
        season_arc: '第一阶段围绕秘密推进',
        continuity_rules: ['不生成图片或视频'],
        quality_score: 85,
        generatedAt: '2026-05-23T00:00:00.000Z',
        version: 'studio-story-bible-v1',
        missingReason: null,
      }).passed
    ).toBe(true);

    expect(
      validateStoryBibleQuality({
        id: 'story-bible-1',
        projectId: 'project-1',
        status: 'ready',
        title: '残缺故事圣经',
        genre: null,
        worldview: null,
        mainConflict: null,
        emotionalArc: null,
        characterRelationship: null,
        longTermForeshadowing: [],
        visualStyle: null,
        targetPlatform: null,
        adaptationStrategy: null,
        audienceHook: null,
        sourceSummary: null,
        sourceEvidence: [],
        quality_score: 20,
        generatedAt: null,
        version: 'studio-story-bible-v1',
        missingReason: null,
      }).passed
    ).toBe(false);
  });
});
