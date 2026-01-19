import { PrismaClient } from 'database';
import { findSimilarChapters } from '../memory/vector_search';
import { getLatestCharacterStates, type CharacterState } from '../graph/graph_state';

/**
 * V3.0 P0-2: 上下文注入器
 *
 * 构建递归注入的三段上下文：
 * 1. Long-term memory: 相似章节检索（pgvector 不可用时降级为空）
 * 2. Short-term memory: 上一章摘要
 * 3. Entity states: 角色状态
 */

export interface ContextPrompt {
  longTermMemory: string;
  shortTermMemory: string;
  entityStates: string;
}

export async function buildContext(params: {
  prisma: PrismaClient;
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  currentTextOrSummary: string;
}): Promise<ContextPrompt> {
  const { prisma, projectId, chapterId, chapterIndex, currentTextOrSummary } = params;

  // 1. Long-term memory: 检索相似章节
  const longTermContext = await buildLongTermMemory({
    prisma,
    projectId,
    currentTextOrSummary,
  });

  // 2. Short-term memory: 上一章摘要
  const shortTermContext = await buildShortTermMemory({
    prisma,
    projectId,
    chapterIndex,
  });

  // 3. Entity states: 角色状态
  const entityContext = await buildEntityStates({
    prisma,
    projectId,
    chapterIndex,
  });

  return {
    longTermMemory: longTermContext,
    shortTermMemory: shortTermContext,
    entityStates: entityContext,
  };
}

async function buildLongTermMemory(params: {
  prisma: PrismaClient;
  projectId: string;
  currentTextOrSummary: string;
}): Promise<string> {
  const { prisma, projectId, currentTextOrSummary } = params;

  if (!currentTextOrSummary) {
    return '# Long-term Memory\n\n无当前文本，无法检索相似章节。';
  }

  const similarChapters = await findSimilarChapters({
    prisma,
    projectId,
    currentTextOrSummary,
    limit: 5,
  });

  if (similarChapters.length === 0) {
    return '# Long-term Memory\n\n无相似历史章节（向量检索功能降级中）。';
  }

  const contextLines = similarChapters.map(
    (ch) =>
      `- ${ch.title || '无标题'} (相似度: ${ch.similarity.toFixed(2)}): ${ch.summary || '无摘要'}`
  );

  return `# Long-term Memory\n\n相似章节参考：\n${contextLines.join('\n')}`;
}

async function buildShortTermMemory(params: {
  prisma: PrismaClient;
  projectId: string;
  chapterIndex: number;
}): Promise<string> {
  const { prisma, projectId, chapterIndex } = params;

  // 查找上一章
  const prevChapter = await prisma.novelChapter.findFirst({
    where: {
      volume: {
        projectId,
      },
      index: chapterIndex - 1,
    },
  });

  if (!prevChapter?.summary) {
    return '# Short-term Memory\n\n无上一章摘要。';
  }

  return `# Short-term Memory\n\n上一章摘要：\n${prevChapter.summary}`;
}

async function buildEntityStates(params: {
  prisma: PrismaClient;
  projectId: string;
  chapterIndex: number;
}): Promise<string> {
  const { prisma, projectId, chapterIndex } = params;

  const characters = await getLatestCharacterStates({
    prisma,
    projectId,
    beforeChapterIndex: chapterIndex,
  });

  if (characters.length === 0) {
    return '# Entity States\n\n无角色状态数据。';
  }

  const stateLines = characters.map((char: CharacterState) => {
    return `- ${char.name}:\n  - 状态: ${char.status}\n  - 衣着: ${char.appearance.clothing}\n  - 头发: ${char.appearance.hair}\n  - 道具: ${char.items.join(', ') || '无'}\n  - 伤势: ${char.injuries.join(', ') || '无'}\n  - 位置: ${char.location}`;
  });

  return `# Entity States\n\n角色状态：\n${stateLines.join('\n')}`;
}
