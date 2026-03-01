import { PrismaClient } from 'database';
import { promises as fsp } from 'fs';
import { fileExists, ensureDir } from '../../../../packages/shared/fs_async';
import * as path from 'path';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { config } from '@scu/config';
import { ProcessorContext } from '../types/processor-context';

export interface TimelineShot {
  shotId: string;
  index: number;
  durationFrames: number;
  startFrames: number; // For auditing & offset calculation
  endFrames: number; // For auditing
  framesTxtStorageKey: string;
  transition: 'none' | 'xfade';
  transitionFrames: number; // Overlap length
}

export interface AudioTrack {
  id: string;
  type: 'dialogue' | 'music' | 'ambient';
  storageKey?: string;
  gain: number;
  loop?: boolean;
  truncate?: 'shortest' | 'longest';
  ducking?: {
    target: string;
    gain: number;
  };
}

export interface AudioConfig {
  tracks: AudioTrack[];
  masterPriority?: string;
  mode?: 'none' | 'loop' | 'truncate'; // Legacy support
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
  audio?: AudioConfig;
}

/**
 * CE10: Timeline Composition Processor
 * 职责：DB 溯源查询 Scene -> Shots，编排确定的 timeline.json，确立全链路渲染参数。
 */
export async function processTimelineComposeJob(context: ProcessorContext) {
  const { prisma, job, apiClient } = context;
  const engineHubClient = context.apiClient ? new EngineHubClient(apiClient) : undefined;
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

  console.log(
    `[TimelineCompose] [${traceId}] Found ${scene.shots.length} shots for scene ${sceneId}: ${scene.shots.map((s) => s.id).join(', ')}`
  );

  if (scene.shots.length < 1) {
    throw new Error(
      `[TimelineCompose] Fail-fast: Scene must have at least 1 shot for timeline compose. Found: ${scene.shots.length}`
    );
  }

  // 1.5 Real Content: TTS Generation (Inject Audio)
  const pendingAudioUpdates: { shotId: string; storageKey: string }[] = [];

  // Use a local map to track latest params including newly generated ones
  const shotParamsMap = new Map<string, any>();

  for (const shot of scene.shots) {
    let params = (shot.params as any) || {};

    // Check if we have dialogue but no audio
    const dialogue = params.dialogue || params.text || params.voiceText;

    if (dialogue && !params.voiceAssetStorageKey && engineHubClient) {
      console.log(
        `[TimelineCompose] [${traceId}] Generating TTS for shot ${shot.id} (${dialogue.substring(0, 10)}...)`
      );

      try {
        const ttsRes = await engineHubClient.invoke<any, any>({
          engineKey: 'tts_standard',
          payload: {
            text: dialogue,
            voiceId: 'default', // TODO: Make configurable
            speed: 1.0,
          },
          metadata: {
            jobId: job.id,
            traceId,
            projectId,
            sceneId,
          },
        });

        if (ttsRes.success && ttsRes.output?.assetPath) {
          const newKey = ttsRes.output.assetPath;
          console.log(`[TimelineCompose] [${traceId}] TTS Generated: ${newKey}`);

          params = { ...params, voiceAssetStorageKey: newKey };
          pendingAudioUpdates.push({ shotId: shot.id, storageKey: newKey });
        } else {
          console.warn(`[TimelineCompose] [${traceId}] TTS Generation failed or empty output`);
        }
      } catch (err: any) {
        console.error(`[TimelineCompose] [${traceId}] TTS Engine Error: ${err.message}`);
      }
    }

    shotParamsMap.set(shot.id, params);
  }

  // Persist updates to DB (Best Effort)
  if (pendingAudioUpdates.length > 0) {
    console.log(
      `[TimelineCompose] [${traceId}] Persisting ${pendingAudioUpdates.length} audio keys to DB...`
    );
    await Promise.allSettled(
      pendingAudioUpdates.map((u) =>
        prisma.shot.update({
          where: { id: u.shotId },
          data: {
            params: shotParamsMap.get(u.shotId),
          },
        })
      )
    );
  }

  // 2. 编排确定性 Timeline 数据 (Hard Constraints)
  // 锁死参数：S4-7 统一 24fps, 1280x720
  const fps = 24;
  const width = 1280;
  const height = 720;

  let currentFrame = 0;
  const timelineShots: TimelineShot[] = [];
  for (const [idx, shot] of (scene.shots as any[]).entries()) {
    const params = shotParamsMap.get(shot.id) || (shot.params as any) || {};
    const durationFrames = (shot.durationSeconds || 1) * fps;

    // S4-8: 增强转场检测
    const transition = params.transition === 'xfade' ? 'xfade' : 'none';
    const transitionFrames =
      transition === 'xfade' ? Math.floor((params.transitionSec || 0.5) * fps) : 0;

    // 安全校验：转场长度不能超过镜头时长一半
    if (transition === 'xfade' && transitionFrames >= durationFrames / 2) {
      throw new Error(
        `[TimelineCompose] Transition frames (${transitionFrames}) too long for shot ${shot.id} duration (${durationFrames})`
      );
    }

    // 计算 Start/End (Auditing)
    // 第一个镜头没有“进入”转场
    const actualStart = idx === 0 ? 0 : currentFrame - transitionFrames;
    const actualEnd = actualStart + durationFrames;

    // Generate frames.txt if shot has resultImageUrl
    const framesTxtPath = path.join(process.cwd(), '.runtime', 'frames', shot.id, 'frames.txt');

    // Resolve Storage Root
    const storageRoot = (config as any).storageRoot;

    if (shot.resultImageUrl) {
      const imageAbsPath = path.resolve(storageRoot, shot.resultImageUrl);
      if (await fileExists(imageAbsPath)) {
        const dir = path.dirname(framesTxtPath);
        if (!(await fileExists(dir))) await ensureDir(dir);

        // Generate ffmpeg concat format frames.txt
        // duration is specified in seconds per line? Or just repeat the file?
        // "file '/path/to/image.png'"
        // "duration 2.5"
        // For single image as video, we usually use:
        // file 'path'
        // duration <total_duration>
        // file 'path' (repeat last frame to ensure duration covers)

        const durationSec = shot.durationSeconds || 1.0;
        const content = `file '${imageAbsPath}'\nduration ${durationSec}\nfile '${imageAbsPath}'`;
        await fsp.writeFile(framesTxtPath, content);
        console.log(
          `[TimelineCompose] Generated frames.txt for shot ${shot.id} at ${framesTxtPath}`
        );
      }
    }

    const s: TimelineShot = {
      shotId: shot.id,
      index: shot.index,
      durationFrames,
      startFrames: actualStart,
      endFrames: actualEnd,
      framesTxtStorageKey: framesTxtPath,
      transition,
      transitionFrames,
    };

    // 更新游标：下一个镜头的基准开始时间是当前镜头的结束点
    currentFrame = actualEnd;

    timelineShots.push(s);
  }

  const timelineData: TimelineData = {
    sceneId,
    projectId,
    episodeId,
    organizationId,
    fps,
    width,
    height,
    shots: timelineShots,
    audio: {
      tracks: [
        ...((job.payload as any).bgmStorageKey
          ? [
              {
                id: 'bgm',
                type: 'music' as const,
                storageKey: (job.payload as any).bgmStorageKey,
                gain: (job.payload as any).bgmGain || 0.5,
                loop: (job.payload as any).bgmMode === 'loop',
                ducking: { target: 'dialogue', gain: 0.2 },
                truncate: 'shortest' as const,
              },
            ]
          : []),
        ...scene.shots
          .map((s) => {
            const params = shotParamsMap.get(s.id) || (s.params as any) || {};
            if (params.voiceAssetStorageKey) {
              const track: AudioTrack = {
                id: `voice-${s.id}`,
                type: 'dialogue',
                storageKey: params.voiceAssetStorageKey,
                gain: 1.0,
              };
              return track;
            }
            return null;
          })
          .filter((t): t is AudioTrack => t !== null),
      ],
      masterPriority: 'dialogue',
    },
  };

  // 3. 产物持久化
  const runtimeDir = path.join(process.cwd(), '.runtime', 'timelines');
  if (!(await fileExists(runtimeDir))) await ensureDir(runtimeDir);

  const timelineFileName = `timeline_${sceneId}_${Date.now()}.json`;
  const timelinePath = path.join(runtimeDir, timelineFileName);

  await fsp.writeFile(timelinePath, JSON.stringify(timelineData, null, 2));
  console.log(`[TimelineCompose] [${traceId}] Timeline generated at: ${timelinePath}`);

  return {
    success: true,
    output: {
      timelineStorageKey: timelinePath,
    },
    message: 'Timeline composed successfully',
    audit: {
      action: 'ce10.timeline_compose.success',
      sceneId,
      projectId,
      traceId,
    },
  };
}
