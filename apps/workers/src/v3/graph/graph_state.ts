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
  scene_index: number;
  chapter_id: string;
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

  // 查找上一章的 memory_short_term 记录
  const shortTermMemory = await prisma.memoryShortTerm.findFirst({
    where: {
      projectId,
      chapterId: {
        in: await prisma.novelChapter
          .findMany({
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
            take: 3, // 检查最近 3 章
          })
          .then((chapters) => chapters.map((c) => c.id)),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

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
        updated_at: new Date().toISOString(),
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

  console.log(`[GRAPH-DEBUG] Updating snapshot for novel_scene ${sceneId}`);
  const updatedCount = await prisma.$executeRaw`
    UPDATE novel_scenes
    SET graph_state_snapshot = ${JSON.stringify(snapshot)}::jsonb
    WHERE id = ${sceneId}
  `;
  console.log(`[GRAPH-DEBUG] Snapshot update count: ${updatedCount}`);
}
