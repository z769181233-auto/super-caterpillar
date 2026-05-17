import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { buildChapterSemanticContext, extractSceneSemanticsFromText } from '@scu/shared-types';
import {
  buildSemanticMemoryContextForChapter,
  upsertChapterSemanticMemory,
} from '../memory/semantic-memory-context';

/**
 * 小说分析处理器
 * 处理 NOVEL_ANALYZE_CHAPTER 类型的 Job
 */
@Injectable()
export class NovelAnalysisProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  private splitMeaningfulParagraphs(rawText: string): string[] {
    const paragraphs = rawText.split(/\n\n+/).filter((p: string) => p.trim().length > 10);
    if (paragraphs.length > 0) {
      return paragraphs;
    }

    const fallback = rawText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return fallback.length > 0 ? fallback : [rawText.trim()].filter((line) => line.length > 0);
  }

  /**
   * 分析章节并生成 SceneDraft
   * 当前使用简单规则，未来替换为 LLM 调用
   */
  async analyzeChapter(chapterId: string): Promise<void> {
    const chapter: any = await this.prisma.novelChapter.findUnique({
      where: { id: chapterId },
      include: {
        novelSource: true,
        scenes: {
          take: 1,
          orderBy: { sceneIndex: 'asc' },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter ${chapterId} not found`);
    }

    // 读取章节原文
    const rawText = chapter.rawContent || chapter.content || '';
    const chapterContext = buildChapterSemanticContext(rawText);
    const memoryContext = await buildSemanticMemoryContextForChapter({
      prisma: this.prisma,
      projectId: chapter.novelSource?.projectId,
      chapterId: chapter.id,
      chapterIndex: chapter.index,
      currentTextOrSummary: rawText,
    });

    await this.prisma.novelChapter.update({
      where: { id: chapterId },
      data: { summary: chapterContext.summary },
    });
    await upsertChapterSemanticMemory({
      prisma: this.prisma,
      projectId: chapter.novelSource?.projectId,
      chapterId,
      chapterSummary: chapterContext.summary,
      characters: chapterContext.characters,
      dominantLocation: chapterContext.dominantLocation,
    });

    // 简单规则：按段落切分场景
    // 未来替换为 LLM 调用
    const paragraphs = this.splitMeaningfulParagraphs(rawText);
    const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));

    // 删除旧的 SceneDraft（如果存在）
    await this.prisma.sceneDraft.deleteMany({
      where: { chapterId },
    });

    // 为每个场景创建 SceneDraft
    let previousSceneContext: ReturnType<typeof extractSceneSemanticsFromText> | undefined;
    for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
      const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
      const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
      const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
      const sceneText = sceneParagraphs.join('\n\n');

      // 提取场景摘要（前100字）
      const summary = sceneText.substring(0, 100).trim() || `场景 ${scIdx + 1}`;
      const semantics = extractSceneSemanticsFromText(sceneText, {
        chapterContext,
        previousSceneContext,
        memoryContext,
      });
      previousSceneContext = semantics;
      const characters = semantics.characters.map((name) => ({ name }));
      const location = semantics.location;

      await this.prisma.sceneDraft.create({
        data: {
          chapterId,
          index: scIdx + 1,
          title: `${chapter.title} - 场景 ${scIdx + 1}`,
          summary,
          characters: characters.length > 0 ? characters : undefined,
          location,
          rawTextRange: {
            startParagraph: startIdx,
            endParagraph: endIdx - 1,
          },
          status: 'ANALYZED', // 标记为已分析
          analysisResult: {
            method: semantics.semanticMethod ?? 'contextual-semantic-engine-v1',
            timestamp: new Date().toISOString(),
            chapterContextSummary: chapterContext.summary,
            coverageReport: chapterContext.coverageReport as unknown as Prisma.InputJsonValue,
            semanticExtraction: {
              characters: semantics.characters,
              location: semantics.location ?? null,
              timeOfDay: semantics.timeOfDay ?? null,
              emotionalTone: semantics.emotionalTone ?? null,
              conflictSummary: semantics.conflictSummary ?? null,
              semanticSummary: semantics.semanticSummary,
              chapterContextSummary: semantics.chapterContextSummary ?? chapterContext.summary,
              memoryContextSummary: semantics.memoryContextSummary ?? memoryContext?.summary ?? null,
              memoryContextSource: semantics.memoryContextSource ?? memoryContext?.source ?? null,
              crossChapterMemoryHit: semantics.crossChapterMemoryHit ?? false,
              fallbackStrategy: semantics.fallbackStrategy ?? 'rule-based-fallback-v1',
            },
          },
        },
      });
    }
  }
}
