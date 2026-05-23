import { ProjectStudioDirectorScriptService } from './project-studio-director-script.service';
import { ProjectStudioEpisodePlanService } from './project-studio-episode-plan.service';
import { ProjectStudioShotScriptService } from './project-studio-shot-script.service';

function createMutablePrismaMock() {
  let metadata: Record<string, any> = {
    animationStudio: {
      storyBible: {
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
      findMany: jest.fn().mockResolvedValue([]),
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
  it('turns fixed novel scene candidates into production-oriented EpisodePlan, DirectorScript, and ShotScript text', async () => {
    const prisma = createMutablePrismaMock();
    const episodePlanService = new ProjectStudioEpisodePlanService(prisma as any);
    const directorScriptService = new ProjectStudioDirectorScriptService(prisma as any);
    const shotScriptService = new ProjectStudioShotScriptService(prisma as any);

    const episodePlans = await episodePlanService.generateEpisodePlans(
      'project-fixed-sample',
      'org-1'
    );
    const directorScripts = await directorScriptService.generateDirectorScripts(
      'project-fixed-sample',
      'org-1'
    );
    const shotScripts = await shotScriptService.generateShotScripts(
      'project-fixed-sample',
      'org-1'
    );

    expect(episodePlans).toHaveLength(1);
    expect(episodePlans[0].plotGoal).toContain('薛知盈');
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
    expect(directorScripts[0].sceneBeats).toHaveLength(4);
    expect(directorScripts[0].sceneBeats.join('\n')).toContain(
      'scene-candidate:chapter-1:scene-candidate:1'
    );
    expect(directorScripts[0].directorNotes.join('\n')).toContain('不允许用旧摘要替代');

    expect(shotScripts).toHaveLength(4);
    for (const shot of shotScripts) {
      expect(shot.duration_sec).toBeGreaterThan(0);
      expect(shot.shot_size).not.toBe('未生成');
      expect(shot.camera_movement).not.toBe('未生成');
      expect(shot.action).toMatch(/薛知盈|王嬷嬷|春桃/);
      expect(shot.dialogue.length > 0 || Boolean(shot.voiceover)).toBe(true);
      expect(shot.sound_design.length).toBeGreaterThan(0);
      expect(shot.lighting).toMatch(/光|影|古风|书斋/);
      expect(shot.emotion).not.toBe('未生成');
      expect(shot.storyboard_prompt).toContain(`镜头 ${shot.shot_no}`);
      expect(shot.video_prompt).toContain('本阶段不调用视频生成');
      expect(shot.source_evidence.join('\n')).toContain('scene-candidate:');
      expect(
        [
          shot.action,
          shot.dialogue.map((item) => item.text).join('\n'),
          shot.storyboard_prompt,
          shot.video_prompt,
        ].join('\n')
      ).not.toMatch(/待编剧精修|旧摘要|未生成/);
    }

    expect(shotScripts[0].dialogue[0].text).toContain('若今日还不懂规矩');
    expect(shotScripts[2].dialogue[0].text).toContain('今日别再闹了');
    expect(prisma.project.update).toHaveBeenCalledTimes(3);
  });
});
