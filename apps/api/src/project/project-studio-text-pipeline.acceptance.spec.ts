import { ProjectStudioDirectorScriptService } from './project-studio-director-script.service';
import { ProjectStudioEpisodePlanService } from './project-studio-episode-plan.service';
import { ProjectProductionStateService } from './project-production-state.service';

function createMutablePrismaMock() {
  let metadata: Record<string, any> = {
    animationStudio: {
      storyBible: {
        id: 'story-bible-fixed-sample',
        project_id: 'project-fixed-sample',
        projectId: 'project-fixed-sample',
        source_type: 'novel_import',
        title: '表姑娘又又又又跑了',
        logline: '薛知盈在家族规训中秘密读书，并在王嬷嬷逼近时寻找脱身机会。',
        genre: '古风宅斗',
        theme: '在规训压力下争取自主选择',
        tone: '克制、紧张、细腻',
        story_world: {
          summary: '古风宅院中的静水院与云墨斋构成主角行动空间。',
          core_locations: [
            { location_id: 'loc-jingshuiyuan', name: '静水院', function: '秘密读书与搜查压力发生地' },
            { location_id: 'loc-yunmozhai', name: '云墨斋', function: '藏书与脱身转折地点' },
          ],
        },
        main_characters: [
          { character_id: 'char-xue-zhiying', name: '薛知盈', role: '主角' },
          { character_id: 'char-wang-momo', name: '王嬷嬷', role: '规训压力来源' },
          { character_id: 'char-chuntao', name: '春桃', role: '协助者' },
        ],
        season_arc: '第一集建立秘密读书、搜查逼近和主角顺势脱身的核心矛盾。',
        continuity_rules: ['薛知盈必须保持秘密读书不暴露', '王嬷嬷代表家族规训压力'],
        source_evidence: [
          'scene-candidate:chapter-1:scene-candidate:1 characters:薛知盈,春桃 location:静水院 sourceBlocks:1 text:薛知盈躲在静水院窗下翻开律法书，低声对春桃说：“若今日还不懂规矩，我便永远只能任人安排。”',
          'scene-candidate:chapter-1:scene-candidate:2 characters:王嬷嬷,春桃,薛知盈 location:静水院 sourceBlocks:2 text:王嬷嬷的脚步声逼近门口，春桃慌忙替薛知盈收起书页，门闩轻轻一响。',
          'scene-candidate:chapter-1:scene-candidate:3 characters:王嬷嬷,薛知盈 location:静水院 sourceBlocks:3 text:王嬷嬷推门进来，笑着劝她：“表姑娘，今日别再闹了，夫人已经等着回话。”',
          'scene-candidate:chapter-1:scene-candidate:4 characters:薛知盈,王嬷嬷 location:云墨斋 sourceBlocks:4 text:薛知盈把书藏进云墨斋旧匣，抬头迎上王嬷嬷的目光，决定先顺势脱身。',
        ],
        quality_score: 88,
        status: 'ready',
        visualStyle: '古风宅院、低饱和暖色、人物心理压迫、细腻表演',
      },
      characterBibles: [
        {
          id: 'character-bible-xue',
          characterId: 'char-xue-zhiying',
          name: '薛知盈',
          assetIds: [],
          status: 'done',
        },
        {
          id: 'character-bible-wang',
          characterId: 'char-wang-momo',
          name: '王嬷嬷',
          assetIds: [],
          status: 'done',
        },
        {
          id: 'character-bible-chuntao',
          characterId: 'char-chuntao',
          name: '春桃',
          assetIds: [],
          status: 'done',
        },
      ],
      locationBibles: [
        {
          id: 'location-bible-jingshui',
          locationId: 'loc-jingshuiyuan',
          name: '静水院',
          lightingMood: '午后柔光被窗棂切碎，室内阴影压低人物情绪',
          status: 'done',
        },
        {
          id: 'location-bible-yunmo',
          locationId: 'loc-yunmozhai',
          name: '云墨斋',
          lightingMood: '书斋墨色偏冷，烛光压出秘密感',
          status: 'done',
        },
      ],
    },
  };

  const project = {
    findFirst: jest.fn().mockImplementation(async () => ({
      id: 'project-fixed-sample',
      name: '表姑娘又又又又跑了',
      metadata,
    })),
    update: jest.fn().mockImplementation(async ({ data }) => {
      metadata = data.metadata as Record<string, any>;
      return { id: 'project-fixed-sample', metadata };
    }),
  };

  return {
    project,
    storySource: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    novelSource: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'novel-source-fixed-sample',
        fileName: '表姑娘又又又又跑了.txt',
      }),
    },
    novel: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'novel-fixed-sample',
        title: '表姑娘又又又又跑了',
        chapters: [
          {
            id: 'chapter-1',
            index: 1,
            title: '第一章',
            summary: '薛知盈在静水院偷读律法书，王嬷嬷逼近搜查。',
            rawContent: '薛知盈在静水院偷读律法书，春桃替她望风，王嬷嬷推门逼问。',
          },
        ],
      }),
    },
    episode: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    scene: {
      count: jest.fn().mockResolvedValue(0),
    },
    shot: {
      count: jest.fn().mockResolvedValue(0),
    },
    videoJob: {
      count: jest.fn().mockResolvedValue(0),
    },
    qualityScore: {
      count: jest.fn().mockResolvedValue(0),
    },
    novelAnalysisJob: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sceneDraft: {
      findMany: jest.fn().mockResolvedValue([
        {
          chapterId: 'chapter-1',
          analysisResult: {
            coverageReport: {
              sceneCandidateCount: 4,
              characterCount: 3,
              locationCount: 2,
              dialogueBlockCount: 4,
              actionBlockCount: 4,
              qualityGate: { status: 'pass' },
              sceneCandidates: [
                {
                  candidateId: 'chapter-1:scene-candidate:1',
                  index: 1,
                  source: 'paragraph',
                  text: '薛知盈躲在静水院窗下翻开律法书，低声对春桃说：“若今日还不懂规矩，我便永远只能任人安排。”',
                  characters: ['薛知盈', '春桃'],
                  location: '静水院',
                  timeOfDay: '午后',
                  emotionalTone: '压抑',
                  conflictSummary: '秘密读书与家族规训冲突',
                  dialogueBlockIndexes: [1],
                  actionBlockIndexes: [1],
                  sourceBlockIndexes: [1],
                  confidence: 'high',
                  traceReason: '人物、地点、对白、动作同时命中',
                },
                {
                  candidateId: 'chapter-1:scene-candidate:2',
                  index: 2,
                  source: 'paragraph',
                  text: '王嬷嬷的脚步声逼近门口，春桃慌忙替薛知盈收起书页，门闩轻轻一响。',
                  characters: ['王嬷嬷', '春桃', '薛知盈'],
                  location: '静水院',
                  timeOfDay: '午后',
                  emotionalTone: '紧张',
                  conflictSummary: '秘密即将暴露',
                  dialogueBlockIndexes: [2],
                  actionBlockIndexes: [2],
                  sourceBlockIndexes: [2],
                  confidence: 'high',
                  traceReason: '动作与场景压力清晰',
                },
                {
                  candidateId: 'chapter-1:scene-candidate:3',
                  index: 3,
                  source: 'paragraph',
                  text: '王嬷嬷推门进来，笑着劝她：“表姑娘，今日别再闹了，夫人已经等着回话。”',
                  characters: ['王嬷嬷', '薛知盈'],
                  location: '静水院',
                  timeOfDay: '午后',
                  emotionalTone: '压迫',
                  conflictSummary: '长辈规训压住主角选择',
                  dialogueBlockIndexes: [3],
                  actionBlockIndexes: [3],
                  sourceBlockIndexes: [3],
                  confidence: 'high',
                  traceReason: '对白与人物关系明确',
                },
                {
                  candidateId: 'chapter-1:scene-candidate:4',
                  index: 4,
                  source: 'paragraph',
                  text: '薛知盈把书藏进云墨斋旧匣，抬头迎上王嬷嬷的目光，决定先顺势脱身。',
                  characters: ['薛知盈', '王嬷嬷'],
                  location: '云墨斋',
                  timeOfDay: '午后',
                  emotionalTone: '决断',
                  conflictSummary: '主角从被动躲藏转为主动应对',
                  dialogueBlockIndexes: [4],
                  actionBlockIndexes: [4],
                  sourceBlockIndexes: [4],
                  confidence: 'medium',
                  traceReason: '动作转折与场景明确',
                },
              ],
            },
          },
        },
      ]),
    },
  };
}

describe('Studio text production pipeline acceptance', () => {
  it('stops the Phase 1B-B text pipeline at production-ready EpisodePlan and DirectorScript', async () => {
    const prisma = createMutablePrismaMock();
    const episodePlanService = new ProjectStudioEpisodePlanService(prisma as any);
    const directorScriptService = new ProjectStudioDirectorScriptService(prisma as any);
    const productionStateService = new ProjectProductionStateService(prisma as any);

    const episodePlans = await episodePlanService.generateEpisodePlans(
      'project-fixed-sample',
      'org-1'
    );
    const directorScripts = await directorScriptService.generateDirectorScripts(
      'project-fixed-sample',
      'org-1'
    );

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0].status).toBe('ready');
    expect(episodePlans[0].quality_score).toBeGreaterThanOrEqual(70);
    expect(episodePlans[0].plotGoal).toContain('薛知盈');
    expect(episodePlans[0].beginning).toBeTruthy();
    expect(episodePlans[0].middle).toBeTruthy();
    expect(episodePlans[0].end).toBeTruthy();
    expect(episodePlans[0].key_scenes?.length).toBeGreaterThanOrEqual(3);
    expect(episodePlans[0].appearingCharacterNames).toEqual(
      expect.arrayContaining(['薛知盈', '王嬷嬷', '春桃'])
    );
    expect(episodePlans[0].appearingLocationNames).toEqual(
      expect.arrayContaining(['静水院', '云墨斋'])
    );
    expect(episodePlans[0].sourceEvidence.join('\n')).toContain(
      'scene-candidate:chapter-1:scene-candidate:1'
    );
    expect(episodePlans[0].sourceEvidence.join('\n')).toContain('sourceBlocks:1');

    expect(directorScripts).toHaveLength(1);
    expect(directorScripts[0].status).toBe('ready');
    expect(directorScripts[0].quality_score).toBeGreaterThanOrEqual(70);
    expect(directorScripts[0].visual_strategy).toContain('静水院');
    expect(directorScripts[0].pacing_strategy).toBeTruthy();
    expect(directorScripts[0].camera_strategy).toBeTruthy();
    expect(directorScripts[0].character_blocking).toBeTruthy();
    expect(directorScripts[0].lighting_strategy).toBeTruthy();
    expect(directorScripts[0].sound_strategy).toBeTruthy();
    expect(directorScripts[0].sceneBeats).toHaveLength(3);
    expect(directorScripts[0].source_evidence?.join('\n')).toContain(
      'scene-candidate:chapter-1:scene-candidate:1'
    );
    expect(directorScripts[0].directorNotes.join('\n')).toContain('本轮不生成 ShotScript');
    expect(directorScripts[0].source_evidence?.length).toBeGreaterThanOrEqual(3);

    const persistedProject = await prisma.project.findFirst();
    const animationStudio = persistedProject.metadata.animationStudio;
    expect(animationStudio.episodePlans).toHaveLength(1);
    expect(animationStudio.episodePlans[0].status).toBe('ready');
    expect(animationStudio.directorScripts).toHaveLength(1);
    expect(animationStudio.directorScripts[0].status).toBe('ready');
    expect(animationStudio.shotScripts).toBeUndefined();

    const productionState = await productionStateService.getProductionState('project-fixed-sample', 'org-1');
    expect(productionState.stages.find((stage) => stage.key === 'episodes_ready')?.status).toBe('done');
    expect(productionState.stages.find((stage) => stage.key === 'director_script_ready')?.status).toBe('done');
    expect(productionState.stages.find((stage) => stage.key === 'shot_script_ready')?.status).not.toBe('done');
    expect(prisma.project.update).toHaveBeenCalledTimes(2);
  });
});
