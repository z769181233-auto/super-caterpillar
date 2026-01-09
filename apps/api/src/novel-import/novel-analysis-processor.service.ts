import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 小说分析处理器
 * 处理 NOVEL_ANALYZE_CHAPTER 类型的 Job
 */
@Injectable()
export class NovelAnalysisProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分析章节并生成 SceneDraft
   * 当前使用简单规则，未来替换为 LLM 调用
   */
  async analyzeChapter(chapterId: string): Promise<void> {
    const chapter = await this.prisma.novelChapter.findUnique({
      where: { id: chapterId },
      include: {
        novelSource: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter ${chapterId} not found`);
    }

    // 读取章节原文
    const rawText = chapter.rawText;

    // 简单规则：按段落切分场景
    // 未来替换为 LLM 调用
    const paragraphs = rawText.split(/\n\n+/).filter((p: string) => p.trim().length > 50);
    const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));

    // 删除旧的 SceneDraft（如果存在）
    await this.prisma.sceneDraft.deleteMany({
      where: { chapterId },
    });

    // 为每个场景创建 SceneDraft
    for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
      const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
      const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
      const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
      const sceneText = sceneParagraphs.join('\n\n');

      // 提取场景摘要（前100字）
      const summary = sceneText.substring(0, 100).trim() || `场景 ${scIdx + 1}`;

      // 简单提取角色和地点（占位实现）
      const characters: Array<{ name: string; role?: string }> = [];
      const location = this.extractLocation(sceneText);

      await this.prisma.sceneDraft.create({
        data: {
          chapterId,
          orderIndex: scIdx + 1,
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
            method: 'rule-based', // 标记为规则分析，未来LLM会改为 'llm'
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  }

  /**
   * 简单提取地点（占位实现）
   * 未来用 LLM 提取
   */
  private extractLocation(text: string): string | undefined {
    // 简单规则：查找包含"在"、"到"、"来到"等词的句子
    const locationPatterns = [/在([^，。！？\n]+)/, /到([^，。！？\n]+)/, /来到([^，。！？\n]+)/];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length < 20) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}
