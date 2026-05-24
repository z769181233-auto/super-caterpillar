import {
  ProjectStudioDirectorScriptService,
  validateDirectorScriptQuality,
} from './project-studio-director-script.service';

function readyEpisodePlan(overrides: Record<string, any> = {}) {
  return {
    id: 'episode-plan-1',
    project_id: 'project-1',
    projectId: 'project-1',
    episode_id: 'episode-1',
    episodeId: 'episode-1',
    story_bible_id: 'story-bible-1',
    episodeNo: 1,
    episode_no: 1,
    title: '第 1 集：表姑娘又又又又跑了',
    status: 'ready',
    durationSec: 300,
    duration_target_sec: 300,
    logline: '薛知盈在静水院藏起秘密，家族压力逼近。',
    beginning: '建立薛知盈在静水院的处境。',
    middle: '王嬷嬷盘问，关系压力上升。',
    end: '秘密即将暴露。',
    plotGoal: '秘密与家族压力',
    emotionCurve: ['处境建立', '压力上升', '悬念收束'],
    emotional_curve: ['处境建立', '压力上升', '悬念收束'],
    key_scenes: [
      { scene_id: 's1', title: '处境建立', summary: '薛知盈藏书', function: '开端', source_evidence: ['Novel:1'] },
      { scene_id: 's2', title: '压力上升', summary: '王嬷嬷盘问', function: '推进', source_evidence: ['NovelSource:1'] },
      { scene_id: 's3', title: '钩子收束', summary: '秘密将露', function: '钩子', source_evidence: ['ChapterEvidence:1'] },
    ],
    coolPoints: ['隐秘行动带来的紧张感'],
    hook: '秘密即将暴露。',
    characters: ['薛知盈', '王嬷嬷'],
    locations: ['静水院'],
    appearingCharacterNames: ['薛知盈', '王嬷嬷'],
    appearingLocationNames: ['静水院'],
    productionStatus: 'ready',
    sourceEvidence: ['Novel:1', 'NovelSource:1', 'ChapterEvidence:1'],
    source_evidence: ['Novel:1', 'NovelSource:1', 'ChapterEvidence:1'],
    quality_score: 85,
    generatedAt: '2026-05-23T00:00:00.000Z',
    version: 'studio-episode-plan-v1',
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

describe('ProjectStudioDirectorScriptService', () => {
  it('returns a missing DirectorScript DTO when metadata has no director scripts', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    const directorScripts = await service.getDirectorScripts('project-1', 'org-1');

    expect(directorScripts).toHaveLength(1);
    expect(directorScripts[0].status).toBe('missing');
    expect(directorScripts[0].missingReason).toBe('导演剧本未生成');
  });

  it('returns blocked when EpisodePlan is missing and does not write metadata', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    const directorScripts = await service.generateDirectorScripts('project-1', 'org-1');

    expect(directorScripts[0].status).toBe('blocked');
    expect(directorScripts[0].missingReason).toContain('EpisodePlan 未生成或未通过质量门槛');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('returns blocked when EpisodePlan fields are incomplete', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              episodePlans: [{ id: 'episode-plan-1', episodeId: 'episode-1', status: 'ready', title: '残缺' }],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    const directorScripts = await service.generateDirectorScripts('project-1', 'org-1');

    expect(directorScripts[0].status).toBe('blocked');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('generates a ready DirectorScript from a ready first EpisodePlan and persists it', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: { animationStudio: { episodePlans: [readyEpisodePlan()] } },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    const directorScripts = await service.generateDirectorScripts('project-1', 'org-1');

    expect(directorScripts).toHaveLength(1);
    expect(directorScripts[0]).toEqual(
      expect.objectContaining({
        director_script_id: 'project-metadata:project-1:director-script:episode-1',
        episode_id: 'episode-1',
        episodeId: 'episode-1',
        status: 'ready',
        sourceEpisodePlanId: 'episode-plan-1',
        version: 'studio-director-script-v1',
      })
    );
    expect(directorScripts[0].visual_strategy).toBeTruthy();
    expect(directorScripts[0].pacing_strategy).toBeTruthy();
    expect(directorScripts[0].camera_strategy).toBeTruthy();
    expect(directorScripts[0].character_blocking).toContain('薛知盈');
    expect(directorScripts[0].lighting_strategy).toBeTruthy();
    expect(directorScripts[0].sound_strategy).toBeTruthy();
    expect(directorScripts[0].scene_beats).toHaveLength(3);
    expect(directorScripts[0].source_evidence?.length).toBeGreaterThanOrEqual(3);
    expect(directorScripts[0].quality_score).toBeGreaterThanOrEqual(70);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              directorScripts: [
                expect.objectContaining({
                  episode_id: 'episode-1',
                  status: 'ready',
                  version: 'studio-director-script-v1',
                }),
              ],
            }),
          }),
        },
      })
    );
  });

  it('blocks DirectorScript when source_evidence is insufficient', () => {
    const episodePlan = readyEpisodePlan();
    const result = validateDirectorScriptQuality(
      {
        id: 'director-script-1',
        projectId: 'project-1',
        episodeId: 'episode-1',
        episodeNo: 1,
        title: '第一集',
        status: 'ready',
        logline: '导演稿',
        beats: [],
        sceneBeats: [],
        visual_strategy: '视觉',
        pacing_strategy: '节奏',
        camera_strategy: '镜头',
        character_blocking: '调度',
        lighting_strategy: '光线',
        sound_strategy: '声音',
        scene_beats: [
          { beat_id: 'b1', scene_id: 's1', dramatic_function: '开端', action: '动作', camera_intent: '中景', source_evidence: [] },
          { beat_id: 'b2', scene_id: 's2', dramatic_function: '推进', action: '动作', camera_intent: '推近', source_evidence: [] },
          { beat_id: 'b3', scene_id: 's3', dramatic_function: '结尾', action: '动作', camera_intent: '留白', source_evidence: [] },
        ],
        keyCharacters: [],
        keyLocations: [],
        visualTone: null,
        dialogueStyle: null,
        soundDesign: null,
        pacingNotes: null,
        directorNotes: [],
        sourceEpisodePlanId: 'episode-plan-1',
        sourceEvidence: ['Novel:1'],
        source_evidence: ['Novel:1'],
        quality_score: 80,
        generatedAt: null,
        version: 'studio-director-script-v1',
        missingReason: null,
      },
      episodePlan as any
    );

    expect(result.passed).toBe(false);
    expect(result.blockers).toContain('source_evidence 少于 3 条。');
  });
});
