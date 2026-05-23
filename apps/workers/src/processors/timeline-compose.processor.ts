import { PrismaClient } from 'database';
import { promises as fsp } from 'fs';
import { fileExists, ensureDir } from '../../../../packages/shared/fs_async';
import * as path from 'path';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { config } from '@scu/config';
import { ProcessorContext } from '../types/processor-context';
import sharp from 'sharp';

/**
 * P1 Standard: Resolve Runtime Dir (Deduplicated across Workers)
 */
function resolveRuntimeDir(): string {
  const root = process.env.RUNTIME_DIR || process.env.SCU_REPO_ROOT || process.cwd();
  return path.resolve(root, '.runtime');
}

export interface TimelineShot {
  shotId: string;
  index: number;
  durationFrames: number;
  startFrames: number; // For auditing & offset calculation
  endFrames: number; // For auditing
  framesTxtStorageKey: string;
  transition: 'none' | 'xfade';
  transitionFrames: number; // Overlap length
  directorPlan?: {
    ruleSetVersion?: string;
    transitionHint?: string;
    editingRhythmStrategy?: string;
    soundStrategy?: string;
    silenceStrategy?: string;
    avgShotLengthSec?: number;
    coverageRole?: string;
    rhythmClass?: string;
    matchedRules?: Array<{ id: string; reason: string }>;
  };
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
  bgmGain?: number;
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

function deriveAudioPreferences(shotParamsList: any[]): {
  masterPriority: string;
  mode: 'none' | 'loop' | 'truncate';
  bgmGain: number;
} {
  const directorPlans = shotParamsList
    .map((params) => {
      const executionPolicy = params?.executionPolicy || {};
      const audioPolicy = executionPolicy.audioPolicy || {};
      return {
        ...params?.directorPlan,
        soundStrategy: audioPolicy.soundStrategy ?? params?.directorPlan?.soundStrategy ?? null,
        silenceStrategy:
          audioPolicy.silenceStrategy ?? params?.directorPlan?.silenceStrategy ?? null,
      };
    })
    .filter(Boolean);

  const soundHints = directorPlans
    .map((plan) => String(plan.soundStrategy || '').toUpperCase())
    .filter(Boolean);
  const silenceHints = directorPlans
    .map((plan) => String(plan.silenceStrategy || '').toUpperCase())
    .filter(Boolean);

  const prefersSilence = silenceHints.some(
    (value) => value.includes('SILENCE') || value.includes('QUIET') || value.includes('BREATH'),
  );
  const prefersDialogueFocus = soundHints.some(
    (value) => value.includes('DIALOGUE') || value.includes('VOICE') || value.includes('INTIMATE'),
  );
  const prefersAmbientLoop = soundHints.some(
    (value) => value.includes('AMBIENT') || value.includes('ATMOS') || value.includes('SPACE'),
  );
  const prefersMusicForward = soundHints.some(
    (value) => value.includes('MUSIC') || value.includes('SCORE') || value.includes('ORCHESTRAL'),
  );

  if (prefersSilence) {
    return {
      masterPriority: 'dialogue',
      mode: 'truncate',
      bgmGain: 0.15,
    };
  }

  if (prefersDialogueFocus) {
    return {
      masterPriority: 'dialogue',
      mode: prefersAmbientLoop ? 'loop' : 'truncate',
      bgmGain: 0.22,
    };
  }

  if (prefersMusicForward) {
    return {
      masterPriority: 'music',
      mode: prefersAmbientLoop ? 'loop' : 'truncate',
      bgmGain: 0.4,
    };
  }

  return {
    masterPriority: 'dialogue',
    mode: prefersAmbientLoop ? 'loop' : 'truncate',
    bgmGain: 0.3,
  };
}

function deriveTransitionProfile(params: any): {
  transition: 'none' | 'xfade';
  transitionSec: number;
} {
  if (params.transition === 'xfade') {
    return {
      transition: 'xfade',
      transitionSec: Number(params.transitionSec || 0.5),
    };
  }

  const executionPolicy = params.executionPolicy || {};
  const timelinePolicy = params.timelinePolicy || {};
  const directorPlan = params.directorPlan || {};
  const transitionHint = String(
    timelinePolicy.transitionHint || executionPolicy.transitionHint || directorPlan.transitionHint || ''
  ).toLowerCase();
  const rhythm = String(
    timelinePolicy.rhythmClass ||
      executionPolicy.rhythmClass ||
      directorPlan.editingRhythmStrategy ||
      ''
  ).toUpperCase();
  const avgShotLengthSec = Number(
    executionPolicy.durationSecTarget || directorPlan.avgShotLengthSec || 0
  );

  if (transitionHint === 'hold') {
    return { transition: 'none', transitionSec: 0 };
  }

  if (transitionHint === 'match_cut') {
    return {
      transition: 'xfade',
      transitionSec: avgShotLengthSec >= 6 || rhythm.includes('LINGER') ? 0.8 : 0.6,
    };
  }

  if (rhythm.includes('FAST') || rhythm.includes('TIGHT')) {
    return { transition: 'xfade', transitionSec: 0.35 };
  }

  if (rhythm.includes('LINGER') || rhythm.includes('HOLD')) {
    return { transition: 'none', transitionSec: 0 };
  }

  return { transition: 'none', transitionSec: 0 };
}

function parsePositiveNumber(
  rawValue: unknown,
  field: string,
  { integerOnly = false }: { integerOnly?: boolean } = {}
): number | null {
  if (rawValue == null || rawValue === '') return null;

  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue)
        : NaN;

  if (!Number.isFinite(value) || value <= 0 || (integerOnly && !Number.isInteger(value))) {
    throw new Error(
      `[TimelineCompose] Invalid ${field}: explicit positive ${integerOnly ? 'integer ' : ''}value required`
    );
  }

  return value;
}

function parseNonNegativeNumber(rawValue: unknown, field: string): number | null {
  if (rawValue == null || rawValue === '') return null;

  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue)
        : NaN;

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[TimelineCompose] Invalid ${field}: explicit non-negative value required`);
  }

  return value;
}

function parseAudioMode(rawValue: unknown): 'none' | 'loop' | 'truncate' | null {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) return null;
  if (rawValue === 'none' || rawValue === 'loop' || rawValue === 'truncate') {
    return rawValue;
  }
  throw new Error('[TimelineCompose] Invalid bgmMode: expected none|loop|truncate');
}

function requireNonEmptyString(value: unknown, contextTag: string, field: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`[${contextTag}] Missing ${field}`);
}

/**
 * CE10: Timeline Composition Processor
 * 职责：DB 溯源查询 Scene -> Shots，编排确定的 timeline.json，确立全链路渲染参数。
 */
export async function processTimelineComposeJob(context: ProcessorContext) {
  const { prisma, job, apiClient } = context;
  const engineHubClient = context.apiClient ? new EngineHubClient(apiClient) : undefined;
  const sceneId = requireNonEmptyString((job.payload as any)?.sceneId, 'TimelineCompose', 'sceneId');
  const pipelineRunId = requireNonEmptyString((job.payload as any)?.pipelineRunId, 'TimelineCompose', 'pipelineRunId');
  const traceId = requireNonEmptyString(job.traceId ?? (job.payload as any)?.traceId, 'TimelineCompose', 'traceId');

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
        include: {
          characterAppearances: {
            include: {
              character: true
            }
          }
        }
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
      try {
        const voiceId = (shot as any).characterAppearances?.[0]?.character?.attributes?.voiceId;
        const ttsPayload: Record<string, any> = {
          text: dialogue,
          speed: 1.0,
        };
        if (voiceId) {
          ttsPayload.voiceId = voiceId;
        }

        const ttsRes = await engineHubClient.invoke<any, any>({
          engineKey: 'tts_standard',
          payload: ttsPayload,
          metadata: {
            jobId: job.id,
            traceId,
            projectId,
            sceneId,
          },
        });

        if (ttsRes.success && ttsRes.output?.assetPath) {
          const newKey = ttsRes.output.assetPath;
          params = { ...params, voiceAssetStorageKey: newKey };
          pendingAudioUpdates.push({ shotId: shot.id, storageKey: newKey });
        }
      } catch {
      }
    }

    shotParamsMap.set(shot.id, params);
  }

  // Persist updates to DB (Best Effort)
  if (pendingAudioUpdates.length > 0) {
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
  const projectSettings = (scene.episode.project.settingsJson as Record<string, unknown> | null) || {};
  const firstShotParams = ((scene.shots[0]?.params as Record<string, unknown> | null) || {}) as Record<
    string,
    unknown
  >;
  const timelinePolicy = ((firstShotParams.timelinePolicy as Record<string, unknown> | null) || {}) as Record<
    string,
    unknown
  >;
  const executionPolicy = ((firstShotParams.executionPolicy as Record<string, unknown> | null) || {}) as Record<
    string,
    unknown
  >;
  const configuredFps =
    parsePositiveNumber(job.payload?.fps, 'fps') ??
    parsePositiveNumber(timelinePolicy.fps, 'fps') ??
    parsePositiveNumber(executionPolicy.fps, 'fps') ??
    parsePositiveNumber(projectSettings.timelineFps, 'fps') ??
    parsePositiveNumber(process.env.TIMELINE_DEFAULT_FPS, 'fps');
  if (!configuredFps) {
    throw new Error('[TimelineCompose] Missing explicit fps. Set payload/project/env timeline fps.');
  }
  const fps = configuredFps;

  const storageRoot = (config as any).storageRoot;
  const firstImageKey = scene.shots.find((shot) => typeof shot.resultImageUrl === 'string' && shot.resultImageUrl.length > 0)
    ?.resultImageUrl;
  if (!firstImageKey) {
    throw new Error('[TimelineCompose] Missing rendered frame/image to infer timeline dimensions');
  }
  const firstImageAbs = path.resolve(storageRoot, firstImageKey);
  if (!(await fileExists(firstImageAbs))) {
    throw new Error(`[TimelineCompose] First rendered frame not found: ${firstImageAbs}`);
  }
  const firstImageMeta = await sharp(firstImageAbs).metadata();
  const inferredWidth = firstImageMeta.width ?? null;
  const inferredHeight = firstImageMeta.height ?? null;
  const width =
    parsePositiveNumber(job.payload?.width, 'width', { integerOnly: true }) ??
    parsePositiveNumber(projectSettings.timelineWidth, 'width', { integerOnly: true }) ??
    inferredWidth;
  const height =
    parsePositiveNumber(job.payload?.height, 'height', { integerOnly: true }) ??
    parsePositiveNumber(projectSettings.timelineHeight, 'height', { integerOnly: true }) ??
    inferredHeight;
  if (!width || !height) {
    throw new Error('[TimelineCompose] Missing timeline width/height and unable to infer from first frame');
  }

  let currentFrame = 0;
  const timelineShots: TimelineShot[] = [];
  const shotParamsList: any[] = [];
  for (const [idx, shot] of (scene.shots as any[]).entries()) {
    const params = shotParamsMap.get(shot.id) || (shot.params as any) || {};
    shotParamsList.push(params);
    const durationFrames = (shot.durationSeconds || 1) * fps;

    // S4-8 + Director Layer: 优先尊重显式 params，其次消费 directorPlan 的节奏/转场提示
    const transitionProfile = deriveTransitionProfile(params);
    const transition = transitionProfile.transition;
    const transitionFrames =
      transition === 'xfade' ? Math.floor(transitionProfile.transitionSec * fps) : 0;

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

    const runtimeRoot = resolveRuntimeDir();
    const framesTxtPath = path.join(runtimeRoot, 'frames', shot.id, 'frames.txt');

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
      directorPlan: {
        ruleSetVersion:
          params.timelinePolicy?.ruleSetVersion ||
          params.executionPolicy?.shotPlannerRuleSetVersion ||
          params.directorPlan?.shotPlannerRuleSetVersion ||
          undefined,
        transitionHint:
          params.timelinePolicy?.transitionHint ||
          params.executionPolicy?.transitionHint ||
          params.directorPlan?.transitionHint ||
          undefined,
        editingRhythmStrategy:
          params.timelinePolicy?.rhythmClass ||
          params.executionPolicy?.rhythmClass ||
          params.directorPlan?.editingRhythmStrategy ||
          undefined,
        soundStrategy:
          params.executionPolicy?.audioPolicy?.soundStrategy ||
          params.directorPlan?.soundStrategy ||
          undefined,
        silenceStrategy:
          params.executionPolicy?.audioPolicy?.silenceStrategy ||
          params.directorPlan?.silenceStrategy ||
          undefined,
        avgShotLengthSec:
          params.executionPolicy?.durationSecTarget ||
          params.directorPlan?.avgShotLengthSec ||
          undefined,
        coverageRole:
          params.timelinePolicy?.coverageRole ||
          params.executionPolicy?.coverageRole ||
          undefined,
        rhythmClass:
          params.timelinePolicy?.rhythmClass ||
          params.executionPolicy?.rhythmClass ||
          undefined,
        matchedRules: Array.isArray(params.timelinePolicy?.matchedRules)
          ? params.timelinePolicy.matchedRules
          : undefined,
      },
    };

    // 更新游标：下一个镜头的基准开始时间是当前镜头的结束点
    currentFrame = actualEnd;

    timelineShots.push(s);
  }

  const audioPreferences = deriveAudioPreferences(shotParamsList);
  const explicitBgmGain = parseNonNegativeNumber((job.payload as any).bgmGain, 'bgmGain');
  const explicitBgmMode = parseAudioMode((job.payload as any).bgmMode);

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
                gain: explicitBgmGain ?? audioPreferences.bgmGain,
                loop: (explicitBgmMode ?? audioPreferences.mode) === 'loop',
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
      masterPriority: audioPreferences.masterPriority,
      mode: audioPreferences.mode,
    },
  };

  // 3. 产物持久化
  const runtimeDir = path.join(resolveRuntimeDir(), 'timelines');
  if (!(await fileExists(runtimeDir))) await ensureDir(runtimeDir);

  const timelineFileName = `timeline_${sceneId}_${Date.now()}.json`;
  const timelinePath = path.join(runtimeDir, timelineFileName);

  await fsp.writeFile(timelinePath, JSON.stringify(timelineData, null, 2));

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
