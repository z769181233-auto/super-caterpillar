import { PrismaClient, Prisma } from 'database';

/**
 * V3.0 P0-2: Graph 状态管理服务
 *
 * 使用现有表结构管理角色状态：
 * - memory_short_term.character_states: 短期状态（JSON）
 * - scenes.graph_state_snapshot: 场景快照（JSONB）
 */

export interface CharacterState {
  id: string;
  name: string;
  status: string;
  appearance: {
    clothing: string;
    hair: string;
  };
  items: string[];
  injuries: string[];
  location: string;
}

export interface GraphStateSnapshot {
  characters: CharacterState[];
  sceneIndex: number;
  chapterId: string;
}

/**
 * 获取最新的角色状态（上一章或最近一次）
 */
export async function getLatestCharacterStates(params: {
  prisma: PrismaClient | Prisma.TransactionClient;
  projectId: string;
  beforeChapterIndex: number;
}): Promise<CharacterState[]> {
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

  const shortTermMemory =
    priorChapters
      .map((chapter) => shortTermMemories.find((memory) => memory.chapterId === chapter.id))
      .find(Boolean) ?? null;

  if (!shortTermMemory?.characterStates) {
    return [];
  }

  const states = shortTermMemory.characterStates as any;
  return states.characters || [];
}

/**
 * 更新角色状态到 memory_short_term
 */
export async function updateCharacterStates(params: {
  prisma: PrismaClient | Prisma.TransactionClient;
  projectId: string;
  chapterId: string;
  characterStates: CharacterState[];
}): Promise<void> {
  const { prisma, projectId, chapterId, characterStates } = params;

  await prisma.memoryShortTerm.create({
    data: {
      projectId,
      chapterId,
      characterStates: {
        characters: characterStates,
        updatedAt: new Date().toISOString(),
      } as any,
    },
  });
}

/**
 * 写入场景的 graph_state_snapshot
 */
export async function snapshotScene(params: {
  prisma: PrismaClient | Prisma.TransactionClient;
  sceneId: string;
  snapshot: GraphStateSnapshot;
}): Promise<void> {
  const { prisma, sceneId, snapshot } = params;

  await (prisma as any).scene.update({
    where: { id: sceneId },
    data: {
      graphStateSnapshot: snapshot as any,
    },
  });
}
