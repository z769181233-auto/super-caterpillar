import { BadRequestException } from '@nestjs/common';
import { ProjectStudioCharacterBibleService } from './project-studio-character-bible.service';

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
    ...overrides,
  };
}

describe('ProjectStudioCharacterBibleService', () => {
  it('returns a missing CharacterBible DTO when metadata has no character bibles', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioCharacterBibleService(prisma as any);

    const characters = await service.getCharacterBibles('project-1', 'org-1');

    expect(characters).toHaveLength(1);
    expect(characters[0].status).toBe('missing');
    expect(characters[0].missingReason).toBe('角色资产未生成');
  });

  it('generates deterministic CharacterBible records from legacy novel chapters', async () => {
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
              rawContent: '春桃陪在门外，萧昀祈回府的消息传来。',
            },
          ],
        }),
      },
    });
    const service = new ProjectStudioCharacterBibleService(prisma as any);

    const characters = await service.generateCharacterBibles('project-1', 'org-1');

    expect(characters.map((character) => character.name)).toEqual(
      expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷'])
    );
    expect(characters.find((character) => character.name === '薛知盈')?.profilePrompt).toContain(
      '薛知盈'
    );
    expect(characters.every((character) => character.assetIds.length === 0)).toBe(true);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              characterBibles: expect.arrayContaining([
                expect.objectContaining({
                  name: '薛知盈',
                  status: 'done',
                  version: 'studio-character-bible-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
  });

  it('does not generate CharacterBible when no StorySource or legacy novel source exists', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioCharacterBibleService(prisma as any);

    await expect(service.generateCharacterBibles('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
