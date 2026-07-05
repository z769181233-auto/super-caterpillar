import {
  ProjectStudioVideoPromptService,
  validateVideoPromptQuality,
} from './project-studio-video-prompt.service';

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

describe('ProjectStudioVideoPromptService', () => {
  it('returns a missing VideoPrompt DTO when metadata has no video prompts', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioVideoPromptService(prisma as any);

    const prompts = await service.getVideoPrompts('project-1', 'org-1');

    expect(prompts).toHaveLength(1);
    expect(prompts[0].status).toBe('missing');
    expect(prompts[0].prompt).toBeNull();
    expect(prompts[0].missingReason).toBe('视频提示词未生成');
  });

  it('generates deterministic VideoPrompt text output from ShotScript and StoryboardAsset metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              shotScripts: [
                {
                  shot_id: 'shot-script-1',
                  episode_id: 'episode-1',
                  shot_no: 1,
                  scene_id: 'episode-1:scene-1',
                  location_id: 'loc-jingshui',
                  duration_sec: 5,
                  characters: [
                    { character_id: 'char-xue', character_name: '薛知盈' },
                    { character_id: 'char-wang', character_name: '王嬷嬷' },
                  ],
                  dialogue: [{ character_name: '王嬷嬷', text: '大公子已回府。' }],
                  sound_design: ['纸页翻动', '脚步逼近'],
                  action: '薛知盈藏起律法书，王嬷嬷推门而入。',
                  shot_size: '近景',
                  camera_movement: '缓慢推进',
                  lighting: '春日柔光与室内暗影形成压迫反差',
                  emotion: '压力上升',
                  visual_goal: '呈现秘密即将暴露的压力。',
                  continuity_notes: ['沿用 CharacterBible 的服装设定。'],
                  status: 'ready',
                },
              ],
              characterBibles: [
                {
                  characterId: 'char-xue',
                  name: '薛知盈',
                  status: 'done',
                },
                {
                  characterId: 'char-wang',
                  name: '王嬷嬷',
                  status: 'done',
                },
              ],
              locationBibles: [
                {
                  locationId: 'loc-jingshui',
                  name: '静水院',
                  status: 'done',
                },
              ],
              storyboardAssets: [
                {
                  id: 'storyboard-asset-1',
                  shotId: 'shot-script-1',
                  status: 'done',
                  assetKind: 'text_binding',
                  assetUrl: null,
                  assetStorageKey: null,
                  prompt: '近景，缓慢推进，薛知盈藏书。',
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioVideoPromptService(prisma as any);

    const prompts = await service.generateVideoPrompts('project-1', 'org-1');

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toEqual(
      expect.objectContaining({
        id: 'project-metadata:project-1:video-prompt:shot-script-1',
        projectId: 'project-1',
        shotId: 'shot-script-1',
        episodeId: 'episode-1',
        shotNo: 1,
        sceneId: 'episode-1:scene-1',
        status: 'done',
        durationSec: 5,
        aspectRatio: '16:9',
        cameraLanguage: '近景 / 缓慢推进',
        sourceShotScriptId: 'shot-script-1',
        sourceStoryboardAssetId: 'storyboard-asset-1',
        qualityScore: 100,
        version: 'studio-video-prompt-v1',
      })
    );
    expect(prompts[0].prompt).toContain('本阶段只输出视频提示词，不创建视频任务');
    expect(prompts[0].negativePrompt).toContain('角色变脸');
    expect(prompts[0].dialogueCue).toContain('王嬷嬷');
    expect(prompts[0].characters).toEqual(expect.arrayContaining(['薛知盈', '王嬷嬷']));
    expect(prompts[0].continuityNotes.join('\n')).toContain('未创建 VideoJob');
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              videoPrompts: expect.arrayContaining([
                expect.objectContaining({
                  shotId: 'shot-script-1',
                  status: 'done',
                  qualityScore: 100,
                  version: 'studio-video-prompt-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('returns blocked VideoPrompt without a real Studio ShotScript and does not write metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              shotScripts: [{ shot_id: 'missing', status: 'missing' }],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioVideoPromptService(prisma as any);

    const prompts = await service.generateVideoPrompts('project-1', 'org-1');

    expect(prompts[0].status).toBe('blocked');
    expect(prompts[0].missingReason).toContain('缺少 ready ShotScript');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('returns blocked VideoPrompt when StoryboardAsset text binding is missing', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              shotScripts: [
                {
                  shot_id: 'shot-script-1',
                  status: 'ready',
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioVideoPromptService(prisma as any);

    const prompts = await service.generateVideoPrompts('project-1', 'org-1');

    expect(prompts[0].status).toBe('blocked');
    expect(prompts[0].missingReason).toContain('StoryboardAsset');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks quality validation when prompt lacks StoryboardAsset binding and continuity', () => {
    const quality = validateVideoPromptQuality(
      [
        {
          id: 'video-prompt-1',
          shotId: 'shot-script-1',
          sourceShotScriptId: 'shot-script-1',
          status: 'done',
          prompt: '镜头级视频提示词',
          negativePrompt: '避免角色变脸',
          durationSec: 5,
          aspectRatio: '16:9',
          cameraLanguage: '近景 / 缓慢推进',
          characters: ['薛知盈'],
          locationId: 'loc-jingshui',
          soundCue: '脚步声',
          lightingCue: '柔光',
          motionCue: '缓慢推进',
          continuityNotes: [],
        },
      ],
      [{ shot_id: 'shot-script-1', status: 'ready' }],
      [{ id: 'storyboard-asset-1', shotId: 'shot-script-1', status: 'done', assetKind: 'text_binding' }],
      [{ characterId: 'char-xue' }],
      [{ locationId: 'loc-jingshui' }]
    );

    expect(quality.passed).toBe(false);
    expect(quality.blockers.join('\n')).toContain('StoryboardAsset 绑定率不足');
    expect(quality.blockers.join('\n')).toContain('continuityNotes 覆盖率不足');
  });
});
