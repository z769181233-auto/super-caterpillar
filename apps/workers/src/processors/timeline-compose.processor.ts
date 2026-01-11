import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../api-client';

export interface TimelineShot {
  shotId: string;
  index: number;
  durationFrames: number;
  framesTxtStorageKey: string;
  transition: 'none';
}

export interface TimelineData {
  sceneId: string;
  projectId: string;
  episodeId: string;
  organizationId: string;
  fps: number;
  width: number;
  height: number;
  shots: TimelineShot[];
}

export interface TimelineComposeParams {
  prisma: PrismaClient;
  job: {
    id: string;
    payload: {
      sceneId: string;
      pipelineRunId: string;
    };
    shotId?: string;
    projectId?: string;
    traceId?: string;
  };
  apiClient: ApiClient;
}

/**
 * CE10: Timeline Composition Processor
 * 职责：DB 溯源查询 Scene -> Shots，编排确定的 timeline.json，确立全链路渲染参数。
 */
export async function processTimelineComposeJob({ prisma, job, apiClient }: TimelineComposeParams) {
  const { sceneId, pipelineRunId } = job.payload;
  const traceId = job.traceId || `trace-${Date.now()}`;

  console.log(`[TimelineCompose] [${traceId}] Starting for scene=${sceneId}`);

  // 1. DB 溯源获取 Context & Shots (Context SSOT)
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: {
      episode: {
        include: {
          project: true,
        },
      },
      shots: {
        orderBy: { index: 'asc' },
      },
    },
  });

  if (!scene) {
    throw new Error(`[TimelineCompose] Scene not found: ${sceneId}`);
  }

  if (!scene.episode || !scene.episode.project) {
    throw new Error(`[TimelineCompose] Project context not found for scene: ${sceneId}`);
  }

  const organizationId = scene.episode.project.organizationId;
  const projectId = scene.episode.project.id;
  const episodeId = scene.episode.id;

  if (scene.shots.length < 2) {
    throw new Error(
      `[TimelineCompose] Fail-fast: Scene must have at least 2 shots for timeline compose. Found: ${scene.shots.length}`
    );
  }

  // 2. 编排确定性 Timeline 数据 (Hard Constraints)
  // 锁死参数：S4-7 统一 24fps, 1280x720
  const fps = 24;
  const width = 1280;
  const height = 720;

  const timelineShots: TimelineShot[] = scene.shots.map((shot: any) => {
    const params = (shot.params as any) || {};

    // 补齐 framesTxtStorageKey：S4-6 逻辑要求每个 shot 都有自己的帧列表
    // 这里的 framesTxt 为之前渲染准备阶段生成的帧列表文件路径（约定路径）
    const framesTxtPath = path.join(process.cwd(), '.runtime', 'frames', shot.id, 'frames.txt');

    // 硬约束：transition 必须为 none
    if (params.transition && params.transition !== 'none') {
      throw new Error(
        `[TimelineCompose] Fail-fast: Transition '${params.transition}' not supported in S4-7. Only 'none' allowed.`
      );
    }

    return {
      shotId: shot.id,
      index: shot.index,
      durationFrames: (shot.durationSeconds || 1) * fps, // 确定性持续时间（帧）
      framesTxtStorageKey: framesTxtPath,
      transition: 'none',
    };
  });

  const timelineData: TimelineData = {
    sceneId,
    projectId,
    episodeId,
    organizationId,
    fps,
    width,
    height,
    shots: timelineShots,
  };

  // 3. 产物持久化
  const runtimeDir = path.join(process.cwd(), '.runtime', 'timelines');
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

  const timelineFileName = `timeline_${sceneId}_${Date.now()}.json`;
  const timelinePath = path.join(runtimeDir, timelineFileName);

  fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2));
  console.log(`[TimelineCompose] [${traceId}] Timeline generated at: ${timelinePath}`);

  return {
    success: true,
    timelineStorageKey: timelinePath,
    message: 'Timeline composed successfully',
    audit: {
      action: 'ce10.timeline_compose.success',
      sceneId,
      projectId,
      traceId,
    },
  };
}
