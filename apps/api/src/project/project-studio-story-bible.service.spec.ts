import { BadRequestException } from '@nestjs/common';
import { ProjectStudioStoryBibleService } from './project-studio-story-bible.service';

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

    expect(storyBible.status).toBe('done');
    expect(storyBible.title).toBe('表姑娘又又又又跑了');
    expect(storyBible.genre).toContain('古风');
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
                status: 'done',
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

    await expect(service.generateStoryBible('project-1', 'org-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
