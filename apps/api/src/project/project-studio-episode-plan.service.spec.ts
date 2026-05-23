import {
  ProjectStudioEpisodePlanService,
  validateEpisodePlanQuality,
} from './project-studio-episode-plan.service';

function readyStoryBible(overrides: Record<string, any> = {}) {
  return {
    id: 'story-bible-1',
    projectId: 'project-1',
    project_id: 'project-1',
    source_type: 'legacy_novel_source',
    status: 'ready',
    title: '表姑娘又又又又跑了',
    logline: '薛知盈在静水院藏起秘密，家族压力逼近。',
    genre: '古风剧情',
    theme: '身份秩序下的自我选择',
    tone: '克制、悬念、关系张力',
    story_world: {
      setting: '古代宅院',
      core_locations: [{ location_id: 'location-1', name: '静水院', description: '核心院落' }],
    },
    main_characters: [
      { character_id: 'character-1', name: '薛知盈', role: '主角', motivation: '守住秘密', conflict: '家族压力' },
      { character_id: 'character-2', name: '王嬷嬷', role: '压力角色', motivation: '维护规矩', conflict: '盘问主角' },
    ],
    worldview: '古代宅院关系世界',
    mainConflict: '秘密与家族压力',
    emotionalArc: '从躲避到选择',
    characterRelationship: '薛知盈与王嬷嬷形成规训压力',
    longTermForeshadowing: [],
    visualStyle: '古风动画',
    targetPlatform: '短剧动漫',
    adaptationStrategy: '先故事圣经后剧集规划',
    audienceHook: '秘密即将暴露。',
    sourceSummary: '薛知盈在静水院藏书。',
    sourceEvidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'ChapterEvidence:1:薛知盈在静水院藏书'],
    source_evidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'ChapterEvidence:1:薛知盈在静水院藏书'],
    quality_score: 85,
    generatedAt: '2026-05-23T00:00:00.000Z',
    version: 'studio-story-bible-v1',
    missingReason: null,
    ...overrides,
  };
}

function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        metadata: {},
      }),
      update: jest.fn().mockResolvedValue({ id: 'project-1' }),
    },
    ...overrides,
  };
}

describe('ProjectStudioEpisodePlanService', () => {
  it('returns a missing EpisodePlan DTO when metadata has no episode plans', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.getEpisodePlans('project-1', 'org-1');

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0].status).toBe('missing');
    expect(episodePlans[0].missingReason).toBe('剧集规划未生成');
  });

  it('returns blocked when StoryBible is missing and does not write metadata', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans[0].status).toBe('blocked');
    expect(episodePlans[0].missingReason).toContain('StoryBible 未生成或未通过质量门槛');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('returns blocked when StoryBible fields are incomplete', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: { animationStudio: { storyBible: { id: 'story-bible-1', status: 'ready', title: '残缺' } } },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans[0].status).toBe('blocked');
    expect(episodePlans[0].missingReason).toContain('缺少 StorySource 或 NovelSource compatibility');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('generates only the first ready EpisodePlan from a ready StoryBible and persists it', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: { animationStudio: { storyBible: readyStoryBible() } },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioEpisodePlanService(prisma as any);

    const episodePlans = await service.generateEpisodePlans('project-1', 'org-1');

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0]).toEqual(
      expect.objectContaining({
        episode_id: 'episode-1',
        episodeId: 'episode-1',
        episode_no: 1,
        episodeNo: 1,
        story_bible_id: 'story-bible-1',
        status: 'ready',
        duration_target_sec: 300,
      })
    );
    expect(episodePlans[0].beginning).toContain('薛知盈');
    expect(episodePlans[0].middle).toBeTruthy();
    expect(episodePlans[0].end).toBeTruthy();
    expect(episodePlans[0].key_scenes).toHaveLength(3);
    expect(episodePlans[0].characters).toEqual(expect.arrayContaining(['薛知盈', '王嬷嬷']));
    expect(episodePlans[0].locations).toEqual(expect.arrayContaining(['静水院']));
    expect(episodePlans[0].source_evidence?.length).toBeGreaterThanOrEqual(3);
    expect(episodePlans[0].quality_score).toBeGreaterThanOrEqual(70);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              episodePlans: [
                expect.objectContaining({
                  episode_id: 'episode-1',
                  status: 'ready',
                  version: 'studio-episode-plan-v1',
                }),
              ],
            }),
          }),
        },
      })
    );
  });

  it('blocks EpisodePlan when source_evidence is insufficient', () => {
    const storyBible = readyStoryBible();
    const result = validateEpisodePlanQuality(
      {
        id: 'episode-plan-1',
        projectId: 'project-1',
        episodeId: 'episode-1',
        episodeNo: 1,
        title: '第一集',
        status: 'ready',
        durationSec: 300,
        beginning: '开端',
        middle: '中段',
        end: '结尾',
        plotGoal: '目标',
        emotionCurve: ['开端', '压力', '钩子'],
        key_scenes: [
          { scene_id: 's1', title: 's1', summary: 's1', function: '开端', source_evidence: ['Novel:1'] },
          { scene_id: 's2', title: 's2', summary: 's2', function: '中段', source_evidence: [] },
          { scene_id: 's3', title: 's3', summary: 's3', function: '结尾', source_evidence: [] },
        ],
        coolPoints: [],
        hook: '钩子',
        characters: ['薛知盈', '王嬷嬷'],
        locations: ['静水院'],
        appearingCharacterNames: ['薛知盈', '王嬷嬷'],
        appearingLocationNames: ['静水院'],
        productionStatus: 'ready',
        sourceEvidence: ['Novel:1'],
        source_evidence: ['Novel:1'],
        quality_score: 80,
        generatedAt: null,
        version: 'studio-episode-plan-v1',
        missingReason: null,
      },
      storyBible as any
    );

    expect(result.passed).toBe(false);
    expect(result.blockers).toContain('source_evidence 少于 3 条。');
  });
});
