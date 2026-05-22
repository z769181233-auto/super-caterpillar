import { BadRequestException } from '@nestjs/common';
import { ProjectStudioShotScriptService } from './project-studio-shot-script.service';

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

describe('ProjectStudioShotScriptService', () => {
  it('returns a missing ShotScript DTO when metadata has no shot scripts', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.getShotScripts('project-1', 'org-1');

    expect(shotScripts).toHaveLength(1);
    expect(shotScripts[0].status).toBe('missing');
    expect(shotScripts[0].missing_reason).toBe('镜头台本未生成');
    expect(shotScripts[0].shot_id).toBe('missing');
  });

  it('generates deterministic ShotScript records from Studio DirectorScript metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              characterBibles: [
                {
                  id: 'character-1',
                  characterId: 'char-xue',
                  name: '薛知盈',
                  assetIds: [],
                  status: 'done',
                },
                {
                  id: 'character-2',
                  characterId: 'char-wang',
                  name: '王嬷嬷',
                  assetIds: [],
                  status: 'done',
                },
              ],
              locationBibles: [
                {
                  id: 'location-1',
                  locationId: 'loc-jingshui',
                  name: '静水院',
                  lightingMood: '春日柔光与室内暗影形成压迫反差',
                  status: 'done',
                },
              ],
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  episodeNo: 1,
                  title: '第一集：藏起律法书',
                  status: 'done',
                  sceneBeats: [
                    '场次 1：开场铺陈。导演目标：建立静水院中的秘密行动。',
                    '场次 2：压力上升。导演目标：王嬷嬷临近，薛知盈必须藏书。',
                    '场次 3：关系转折。导演目标：主仆压力转为正面对抗。',
                    '场次 4：钩子收束。导演目标：秘密即将暴露。',
                  ],
                  keyCharacters: ['薛知盈', '王嬷嬷'],
                  keyLocations: ['静水院'],
                  visualTone: '古风宅院、压抑光影、细腻人物表演',
                  soundDesign: '院落风声、衣料摩擦、木门轻响',
                  sourceEvidence: [
                    'scene-candidate:chapter-1:scene-candidate:1 | confidence:high | sourceBlocks:1 | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:1 | actionBlocks:1 | text:薛知盈在静水院偷读律法书。',
                    'scene-candidate:chapter-1:scene-candidate:2 | confidence:high | sourceBlocks:2 | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:2 | actionBlocks:2 | text:王嬷嬷临近，薛知盈必须藏书。',
                    'scene-candidate:chapter-1:scene-candidate:3 | confidence:medium | sourceBlocks:3 | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:3 | actionBlocks:3 | text:主仆压力转为正面对抗。',
                    'scene-candidate:chapter-1:scene-candidate:4 | confidence:medium | sourceBlocks:4 | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:4 | actionBlocks:4 | text:秘密即将暴露。',
                  ],
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.generateShotScripts('project-1', 'org-1');

    expect(shotScripts).toHaveLength(4);
    expect(shotScripts[0]).toEqual(
      expect.objectContaining({
        project_id: 'project-1',
        episode_id: 'episode-1',
        shot_no: 1,
        location_id: 'loc-jingshui',
        scene_id: 'episode-1:scene-1',
        character_id: 'char-xue',
        status: 'ready',
        source_director_script_id: 'director-script-1',
        version: 'studio-shot-script-v1',
      })
    );
    expect(shotScripts[0].characters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ character_id: 'char-xue', character_name: '薛知盈' }),
      ])
    );
    expect(shotScripts[0].storyboard_prompt).toContain('镜头 1');
    expect(shotScripts[0].source_evidence.join('\n')).toContain('scene-candidate:chapter-1:scene-candidate:1');
    expect(shotScripts[0].video_prompt).toContain('本阶段不调用视频生成');
    expect(shotScripts[0].dialogue[0].text).toContain('待编剧精修');
    expect(shotScripts[0].continuity_notes.join('\n')).toContain('CharacterBible');
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              shotScripts: expect.arrayContaining([
                expect.objectContaining({
                  episode_id: 'episode-1',
                  shot_no: 1,
                  status: 'ready',
                  version: 'studio-shot-script-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('does not generate ShotScript without a real Studio DirectorScript', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              directorScripts: [{ id: 'placeholder', status: 'missing' }],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    await expect(service.generateShotScripts('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks ShotScript generation when DirectorScript lacks scene candidate evidence', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  title: '第一集：旧导演剧本',
                  status: 'done',
                  sceneBeats: ['场次 1：旧摘要。导演目标：不可追踪。'],
                  keyCharacters: ['薛知盈'],
                  keyLocations: ['静水院'],
                  sourceEvidence: ['旧摘要：薛知盈在静水院。'],
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    await expect(service.generateShotScripts('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks ShotScript generation when scene candidate evidence is not stable enough', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  title: '第一集：弱导演剧本',
                  status: 'done',
                  sceneBeats: ['场次 1：弱候选。导演目标：不可追踪。'],
                  keyCharacters: ['薛知盈'],
                  keyLocations: ['静水院'],
                  sourceEvidence: [
                    'scene-candidate:chapter-1:scene-candidate:weak | confidence:medium | characters:薛知盈 | text:薛知盈在静水院。',
                  ],
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    await expect(service.generateShotScripts('project-1', 'org-1')).rejects.toThrow(
      /No stable scene candidate evidence found for ShotScript generation[\s\S]*missing sourceBlocks/
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
