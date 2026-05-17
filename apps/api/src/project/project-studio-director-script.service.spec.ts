import { BadRequestException } from '@nestjs/common';
import { ProjectStudioDirectorScriptService } from './project-studio-director-script.service';

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

  it('generates deterministic DirectorScript records from Studio EpisodePlan metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              storyBible: {
                visualStyle: '古风宅院、压抑光影、细腻人物表演',
              },
              characterBibles: [
                { id: 'character-1', name: '薛知盈', status: 'done' },
                { id: 'character-2', name: '王嬷嬷', status: 'done' },
              ],
              locationBibles: [
                { id: 'location-1', name: '静水院', status: 'done' },
                { id: 'location-2', name: '云墨斋', status: 'done' },
              ],
              episodePlans: [
                {
                  id: 'episode-plan-1',
                  episodeId: 'episode-1',
                  episodeNo: 1,
                  title: '第一集：藏起律法书',
                  status: 'done',
                  durationSec: 300,
                  plotGoal: '薛知盈在静水院偷读律法书，王嬷嬷忽然来查。',
                  emotionCurve: ['开场铺陈', '压力上升', '秘密行动', '钩子收束'],
                  coolPoints: ['隐秘行动带来的紧张感'],
                  hook: '结尾钩子：秘密即将暴露。',
                  appearingCharacterNames: ['薛知盈', '王嬷嬷'],
                  appearingLocationNames: ['静水院', '云墨斋'],
                  sourceEvidence: [
                    'scene-candidate:chapter-1:scene-candidate:1 | location:静水院 | characters:薛知盈、王嬷嬷 | text:薛知盈在静水院偷读律法书，王嬷嬷忽然来查。',
                  ],
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    const directorScripts = await service.generateDirectorScripts('project-1', 'org-1');

    expect(directorScripts).toHaveLength(1);
    expect(directorScripts[0]).toEqual(
      expect.objectContaining({
        episodeId: 'episode-1',
        episodeNo: 1,
        title: '第一集：藏起律法书',
        status: 'done',
        sourceEpisodePlanId: 'episode-plan-1',
        version: 'studio-director-script-v1',
      })
    );
    expect(directorScripts[0].beats.length).toBeGreaterThanOrEqual(4);
    expect(directorScripts[0].sceneBeats.length).toBeGreaterThan(0);
    expect(directorScripts[0].sceneBeats[0]).toContain('scene-candidate:chapter-1:scene-candidate:1');
    expect(directorScripts[0].sourceEvidence.join('\n')).toContain('scene-candidate:chapter-1:scene-candidate:1');
    expect(directorScripts[0].keyCharacters).toEqual(
      expect.arrayContaining(['薛知盈', '王嬷嬷'])
    );
    expect(directorScripts[0].keyLocations).toEqual(expect.arrayContaining(['静水院', '云墨斋']));
    expect(directorScripts[0].visualTone).toContain('古风宅院');
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              directorScripts: expect.arrayContaining([
                expect.objectContaining({
                  episodeId: 'episode-1',
                  status: 'done',
                  version: 'studio-director-script-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('does not generate DirectorScript without a real Studio EpisodePlan', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              episodePlans: [{ id: 'placeholder', status: 'missing' }],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    await expect(service.generateDirectorScripts('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks DirectorScript generation when EpisodePlan lacks scene candidate evidence', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: {
            animationStudio: {
              episodePlans: [
                {
                  id: 'episode-plan-1',
                  episodeId: 'episode-1',
                  episodeNo: 1,
                  title: '第一集：旧摘要',
                  status: 'done',
                  plotGoal: '旧摘要不能替代 scene candidate。',
                  emotionCurve: ['开场铺陈'],
                  coolPoints: [],
                  sourceEvidence: ['旧摘要：薛知盈在静水院。'],
                },
              ],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioDirectorScriptService(prisma as any);

    await expect(service.generateDirectorScripts('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
