import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StoryBibleDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const STORY_BIBLE_VERSION = 'studio-story-bible-v1';

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function pickText(parts: Array<string | null | undefined>, fallback: string): string {
  const text = parts.filter(Boolean).join('；').trim();
  return text ? truncate(text, 800) : fallback;
}

function buildMissing(projectId: string, reason: string): StoryBibleDTO {
  return {
    id: null,
    projectId,
    status: 'missing',
    title: null,
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
    generatedAt: null,
    version: STORY_BIBLE_VERSION,
    missingReason: reason,
  };
}

@Injectable()
export class ProjectStudioStoryBibleService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoryBible(projectId: string, organizationId: string): Promise<StoryBibleDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const storyBible = asRecord(asRecord(project.metadata).animationStudio).storyBible;
    if (!storyBible || typeof storyBible !== 'object' || Array.isArray(storyBible)) {
      return buildMissing(projectId, '故事圣经未生成');
    }

    return {
      ...buildMissing(projectId, '故事圣经未生成'),
      ...(storyBible as JsonRecord),
      projectId,
      status: 'done',
      missingReason: null,
      version: asString((storyBible as JsonRecord).version) || STORY_BIBLE_VERSION,
    } as StoryBibleDTO;
  }

  async generateStoryBible(projectId: string, organizationId: string): Promise<StoryBibleDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, description: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [storySource, novelSource, novel] = await Promise.all([
      this.prisma.storySource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, path: true },
      }),
      this.prisma.novelSource.findUnique({
        where: { projectId },
        select: { id: true, fileName: true, totalChapters: true },
      }),
      this.prisma.novel.findUnique({
        where: { projectId },
        select: {
          id: true,
          title: true,
          author: true,
          fileName: true,
          chapterCount: true,
          chapters: {
            orderBy: { index: 'asc' },
            take: 8,
            select: { index: true, title: true, summary: true, rawContent: true },
          },
        },
      }),
    ]);

    if (!storySource && !novelSource && !novel) {
      throw new BadRequestException('No StorySource or legacy novel source found');
    }

    const sourceTitle = novel?.title || storySource?.name || project.name;
    const chapterSummaries =
      novel?.chapters?.map((chapter) =>
        pickText(
          [
            chapter.title ? `第 ${chapter.index} 章：${chapter.title}` : `第 ${chapter.index} 章`,
            chapter.summary,
            chapter.rawContent ? truncate(chapter.rawContent.replace(/\s+/g, ' '), 180) : null,
          ],
          `第 ${chapter.index} 章暂无摘要`
        )
      ) || [];
    const chapterCount = novel?.chapterCount || novelSource?.totalChapters || chapterSummaries.length;
    const sourceSummary = pickText(
      [project.description, ...chapterSummaries.slice(0, 4)],
      '当前故事来源已有导入记录，但缺少章节摘要；已生成最小故事圣经骨架。'
    );
    const likelyAncientStyle = /姑娘|夫人|嬷嬷|王府|院|宫|侯|公子|少爷|丫鬟|律法|朝政/.test(sourceSummary);

    const storyBible: StoryBibleDTO = {
      id: `project-metadata:${projectId}:story-bible`,
      projectId,
      status: 'done',
      title: sourceTitle,
      genre: likelyAncientStyle ? '古风剧情 / 女性成长 / 权谋关系' : '剧情向长篇改编',
      worldview: likelyAncientStyle
        ? '以古代宅院、家族秩序与权力关系为核心的叙事世界。'
        : '基于导入小说章节建立的连续叙事世界。',
      mainConflict: pickText(
        [
          chapterSummaries[0],
          chapterSummaries[1],
          '核心冲突需要在后续 Phase 2B 通过角色关系与场景拆解继续细化。',
        ],
        '核心冲突暂未从章节中稳定提取。'
      ),
      emotionalArc: '从处境压力、关系试探到主动选择，后续需要按集拆分为明确情绪曲线。',
      characterRelationship: '当前仅建立故事层关系判断，尚未生成独立 CharacterBible，不能视为角色资产完成。',
      longTermForeshadowing: chapterSummaries.slice(0, 3).map((item) => truncate(item, 120)),
      visualStyle: likelyAncientStyle
        ? '古风动画制作基调：细腻服饰、院落空间、柔和自然光、关系张力驱动镜头。'
        : '连续剧集动画制作基调：强调人物关系、场景连续性与镜头叙事。',
      targetPlatform: '短剧/动漫分集制作工作流',
      adaptationStrategy:
        '先建立故事圣经，再生成角色资产、场景资产、剧集规划和镜头台本；本轮不生成图片或视频。',
      audienceHook: pickText(
        [chapterSummaries[0], '用第一集明确人物处境、关系压力和结尾钩子。'],
        '用第一集建立人物处境和追看钩子。'
      ),
      sourceSummary,
      sourceEvidence: [
        storySource ? `StorySource:${storySource.id}` : '',
        novel ? `Novel:${novel.id}` : '',
        novelSource ? `NovelSource:${novelSource.id}` : '',
        `chapterCount:${chapterCount}`,
      ].filter(Boolean),
      generatedAt: new Date().toISOString(),
      version: STORY_BIBLE_VERSION,
      missingReason: null,
    };

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        storyBible,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        metadata: nextMetadata,
      },
    });

    return storyBible;
  }
}
