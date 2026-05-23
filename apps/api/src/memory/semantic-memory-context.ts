import { Prisma, PrismaClient } from 'database';
import { buildSemanticMemoryContext, type SemanticMemoryContext } from '@scu/shared-types';
import { createHash } from 'crypto';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface CharacterStateLike {
  name: string;
  location?: string;
}

interface PriorChapterSummaryLike {
  id: string;
  title?: string | null;
  summary?: string | null;
  index?: number;
  volume?: {
    index?: number;
  } | null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function summarizeEntityStates(states: CharacterStateLike[]): string {
  if (states.length === 0) {
    return '';
  }
  return states
    .map((state) => `${state.name}${state.location ? `位于${state.location}` : ''}`)
    .join('；');
}

function isPriorChapter(
  chapter: Pick<PriorChapterSummaryLike, 'id' | 'index' | 'volume'>,
  current: { chapterId: string; chapterIndex: number; volumeIndex?: number }
) {
  if (chapter.id === current.chapterId) {
    return false;
  }

  const chapterVolumeIndex = chapter.volume?.index;
  const currentVolumeIndex = current.volumeIndex;

  if (typeof chapterVolumeIndex === 'number' && typeof currentVolumeIndex === 'number') {
    if (chapterVolumeIndex < currentVolumeIndex) {
      return true;
    }
    if (chapterVolumeIndex > currentVolumeIndex) {
      return false;
    }
  }

  if (typeof chapter.index !== 'number') {
    return false;
  }

  return chapter.index < current.chapterIndex;
}

function formatChapterSummaryForMemory(chapter: PriorChapterSummaryLike): string | undefined {
  const summary = chapter.summary?.trim();
  if (!summary) {
    return undefined;
  }

  const fallbackTitle = typeof chapter.index === 'number' ? `第${chapter.index}章` : '无标题章节';
  const title = chapter.title?.trim() || fallbackTitle;
  return `${title}：${summary}`;
}

async function getPriorChapterSummaries(params: {
  prisma: DbClient;
  chapterId: string;
  chapterIndex: number;
}): Promise<string[]> {
  const { prisma, chapterId, chapterIndex } = params;
  const currentChapter = await prisma.novelChapter.findUnique({
    where: { id: chapterId },
    select: {
      novelSourceId: true,
      volume: {
        select: {
          index: true,
        },
      },
    },
  });

  if (!currentChapter?.novelSourceId) {
    return [];
  }

  const candidateChapters = await prisma.novelChapter.findMany({
    where: {
      novelSourceId: currentChapter.novelSourceId,
      summary: {
        not: null,
      },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      index: true,
      volume: {
        select: {
          index: true,
        },
      },
    },
  });

  return candidateChapters
    .filter((chapter) =>
      isPriorChapter(chapter, {
        chapterId,
        chapterIndex,
        volumeIndex: currentChapter.volume?.index,
      })
    )
    .sort((a, b) => {
      const volumeDiff = (b.volume?.index ?? 0) - (a.volume?.index ?? 0);
      if (volumeDiff !== 0) return volumeDiff;
      return (b.index ?? 0) - (a.index ?? 0);
    })
    .map(formatChapterSummaryForMemory)
    .filter((summary): summary is string => Boolean(summary))
    .slice(0, 3);
}

async function getLatestCharacterStates(params: {
  prisma: DbClient;
  projectId: string;
  beforeChapterIndex: number;
}): Promise<CharacterStateLike[]> {
  const { prisma, projectId, beforeChapterIndex } = params;
  const priorChapters = await prisma.novelChapter.findMany({
    where: {
      volume: {
        projectId,
      },
      index: {
        lt: beforeChapterIndex,
      },
    },
    select: { id: true },
    orderBy: { index: 'desc' },
    take: 3,
  });

  if (priorChapters.length === 0) {
    return [];
  }

  const chapterIds = priorChapters.map((chapter) => chapter.id);
  const shortTermMemories = await prisma.memoryShortTerm.findMany({
    where: {
      projectId,
      chapterId: { in: chapterIds },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const selectedMemory =
    priorChapters
      .map((chapter) => shortTermMemories.find((memory) => memory.chapterId === chapter.id))
      .find(Boolean) ?? null;

  const rawStates =
    selectedMemory?.characterStates &&
    typeof selectedMemory.characterStates === 'object' &&
    !Array.isArray(selectedMemory.characterStates)
      ? (selectedMemory.characterStates as Record<string, unknown>).characters
      : undefined;

  if (!Array.isArray(rawStates)) {
    return [];
  }

  return rawStates
    .filter((state): state is Record<string, unknown> => !!state && typeof state === 'object')
    .map((state) => ({
      name: typeof state.name === 'string' ? state.name : '',
      location: typeof state.location === 'string' ? state.location : undefined,
    }))
    .filter((state) => state.name.trim().length > 0);
}

async function generateSimulatedEmbedding(text: string): Promise<number[]> {
  const hash = createHash('sha256').update(text).digest();
  const vector: number[] = new Array(1536).fill(0);
  for (let index = 0; index < 32; index += 1) {
    vector[index] = hash[index] / 255 - 0.5;
  }
  vector[32] = (text.length % 100) / 100;
  return vector;
}

async function getSimilarChapterSummaries(params: {
  prisma: DbClient;
  projectId: string;
  currentTextOrSummary: string;
  excludeChapterId?: string;
}): Promise<string | undefined> {
  const { prisma, projectId, currentTextOrSummary, excludeChapterId } = params;
  if (!currentTextOrSummary.trim()) {
    return undefined;
  }

  const queryVector = await generateSimulatedEmbedding(currentTextOrSummary);
  const vectorString = `[${queryVector.join(',')}]`;

  try {
    const rows = await (prisma as PrismaClient).$queryRawUnsafe<
      Array<{ id: string; title: string | null; summary: string | null }>
    >(
      `SELECT id, title, summary
         FROM novel_chapters
        WHERE volume_id IN (SELECT id FROM novel_volumes WHERE project_id = $2)
          AND summary_vector IS NOT NULL
          AND ($3::text IS NULL OR id <> $3)
        ORDER BY summary_vector <=> $1::vector
        LIMIT 3`,
      vectorString,
      projectId,
      excludeChapterId ?? null
    );

    const summaries = rows
      .map((row) => `${row.title || '无标题'}：${row.summary || '无摘要'}`)
      .filter((item) => item.trim().length > 0);

    return summaries.length > 0 ? summaries.join('；') : undefined;
  } catch {
    return undefined;
  }
}

export async function upsertChapterSemanticMemory(params: {
  prisma: DbClient;
  projectId: string;
  chapterId: string;
  chapterSummary: string;
  characters: string[];
  dominantLocation?: string;
}): Promise<void> {
  const { prisma, projectId, chapterId, chapterSummary, characters, dominantLocation } = params;

  const currentMemory = await prisma.memoryShortTerm.findFirst({
    where: { projectId, chapterId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });

  const characterStates = {
    characters: uniqueStrings(characters).map((name) => ({
      id: name,
      name,
      status: 'present',
      appearance: {
        clothing: 'unknown',
        hair: 'unknown',
      },
      items: [],
      injuries: [],
      location: dominantLocation || 'unknown',
    })),
    updatedAt: new Date().toISOString(),
  };

  if (currentMemory) {
    await prisma.memoryShortTerm.update({
      where: { id: currentMemory.id },
      data: {
        summary: chapterSummary,
        characterStates,
      },
    });
  } else {
    await prisma.memoryShortTerm.create({
      data: {
        projectId,
        chapterId,
        summary: chapterSummary,
        characterStates,
      },
    });
  }

  const embedding = await generateSimulatedEmbedding(chapterSummary);
  const vectorString = `[${embedding.join(',')}]`;
  try {
    await (prisma as PrismaClient).$executeRawUnsafe(
      `UPDATE novel_chapters SET summary_vector = $1::vector WHERE id = $2`,
      vectorString,
      chapterId
    );
  } catch {
    // Local smoke environments may not have pgvector installed yet.
    // Keep semantic memory persistence best-effort so novel analysis still succeeds.
  }
}

export async function buildSemanticMemoryContextForChapter(params: {
  prisma: DbClient;
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  currentTextOrSummary: string;
}): Promise<SemanticMemoryContext | undefined> {
  const { prisma, projectId, chapterId, chapterIndex, currentTextOrSummary } = params;

  const [priorChapterSummaries, similarChapterSummaries, entityStates] = await Promise.all([
    getPriorChapterSummaries({ prisma, chapterId, chapterIndex }),
    getSimilarChapterSummaries({
      prisma,
      projectId,
      currentTextOrSummary,
      excludeChapterId: chapterId,
    }),
    getLatestCharacterStates({ prisma, projectId, beforeChapterIndex: chapterIndex }),
  ]);

  const shortTermSummary = priorChapterSummaries[0];
  const longTermParts = [
    priorChapterSummaries.length > 1
      ? `前序章节：${priorChapterSummaries.join('；')}`
      : priorChapterSummaries[0]
        ? `前序章节：${priorChapterSummaries[0]}`
        : '',
    similarChapterSummaries ? `相似章节：${similarChapterSummaries}` : '',
  ].filter(Boolean);

  return buildSemanticMemoryContext({
    shortTermSummary,
    longTermSummary: longTermParts.length > 0 ? longTermParts.join('\n') : undefined,
    entityStateSummary: summarizeEntityStates(entityStates),
    seededCharacters: entityStates.map((state) => state.name),
  });
}
