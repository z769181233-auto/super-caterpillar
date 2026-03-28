import { PrismaClient, AssetOwnerType, AssetRole, AssetType } from 'database';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { randomUUID } from 'crypto';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';
import sharp from 'sharp';

export interface VideoRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED';
  output?: any;
  videoKey?: string;
  assetId?: string;
  error?: string;
  [key: string]: any;
}

function requireNonEmptyString(value: unknown, contextTag: string, field: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`[${contextTag}] Missing ${field}`);
}

/**
 * Video Render Processor - Hub-only Architecture (PLAN-5)
 * - Removes local FFmpeg concat logic.
 * - Delegates to EngineHub (video_merge).
 * - Handles asset state and audit trail.
 */
export async function processVideoRenderJob(
  context: ProcessorContext
): Promise<VideoRenderProcessorResult> {
  const { prisma, job, apiClient, localStorage } = context;
  const logger = context.logger || console;

  const payload = (job.payload || {}) as any;
  const pipelineRunId = requireNonEmptyString(payload.pipelineRunId, 'VideoRender_HUB', 'pipelineRunId');
  const projectId = requireNonEmptyString(payload.projectId || job.projectId, 'VideoRender_HUB', 'projectId');
  const traceId = requireNonEmptyString(payload.traceId || job.traceId, 'VideoRender_HUB', 'traceId');
  const { frames, frameKeys } = payload;
  let sceneId = payload.sceneId;
  const organizationId = job.organizationId;
  if (!organizationId) {
    throw new Error('[VideoRender_HUB] Missing organizationId');
  }

  logger.log(`[VideoRender_HUB] Processing job ${job.id} for run ${pipelineRunId}`);
  const normalizeStorageKey = async (rawStorageKey: string): Promise<string> => {
    if (!rawStorageKey) {
      throw new Error('VIDEO_MERGE_MISSING_STORAGE_KEY');
    }

    if (!path.isAbsolute(rawStorageKey) || !localStorage) {
      return rawStorageKey;
    }

    const storageRoot = path.resolve(localStorage.root);
    const absoluteSource = path.resolve(rawStorageKey);
    if (absoluteSource === storageRoot || absoluteSource.startsWith(`${storageRoot}${path.sep}`)) {
      return path.relative(storageRoot, absoluteSource);
    }

    const targetRelative = path.join('videos', path.basename(absoluteSource));
    const targetAbsolute = localStorage.getAbsolutePath(targetRelative);
    await fsp.mkdir(path.dirname(targetAbsolute), { recursive: true });
    if (absoluteSource !== targetAbsolute) {
      await fsp.copyFile(absoluteSource, targetAbsolute);
    }
    return targetRelative;
  };

  const parsePositiveNumber = (
    rawValue: unknown,
    field: string,
    { integerOnly = false }: { integerOnly?: boolean } = {}
  ): number => {
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string' && rawValue.trim().length > 0
          ? Number(rawValue)
          : NaN;

    if (!Number.isFinite(value) || value <= 0 || (integerOnly && !Number.isInteger(value))) {
      throw new Error(`[VideoRender_HUB] Invalid ${field}: explicit positive ${integerOnly ? 'integer ' : ''}value required`);
    }

    return value;
  };

  const resolveFrameDimensions = async (
    framePath: string
  ): Promise<{ width: number; height: number }> => {
    const metadata = await sharp(framePath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`[VideoRender_HUB] Unable to detect frame dimensions from ${framePath}`);
    }
    return { width: metadata.width, height: metadata.height };
  };

  try {
    // 1. Resolve sceneId if missing (P4 Fix)
    if (!sceneId && payload.shotId) {
      const shot = await prisma.shot.findUnique({
        where: { id: payload.shotId },
        select: { sceneId: true },
      });
      sceneId = shot?.sceneId;
    }
    if (!sceneId) throw new Error('MISSING_SCENE_ID');

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        id: true,
        projectId: true,
      },
    });
    if (!scene) {
      throw new Error(`[VideoRender_HUB] Scene ${sceneId} not found`);
    }
    if (scene.projectId && scene.projectId !== projectId) {
      throw new Error(
        `[VideoRender_HUB] Scene ${sceneId} belongs to project ${scene.projectId}, not ${projectId}`
      );
    }

    const cleanFramePaths = (frames || frameKeys || []).map((raw: string) => {
      const normalized = raw.replace(/^file:\/\//, '').replace(/^.*\.runtime\//, '');
      if (path.isAbsolute(normalized) || !localStorage) return normalized;
      return localStorage.getAbsolutePath(normalized);
    });
    if (cleanFramePaths.length === 0) {
      throw new Error('[VideoRender_HUB] No frame paths resolved');
    }

    const fps = parsePositiveNumber(
      payload.fps ?? process.env.VIDEO_RENDER_DEFAULT_FPS,
      'fps',
      { integerOnly: false }
    );
    const payloadWidth =
      payload.width == null ? null : parsePositiveNumber(payload.width, 'width', { integerOnly: true });
    const payloadHeight =
      payload.height == null ? null : parsePositiveNumber(payload.height, 'height', { integerOnly: true });
    const inferredDimensions =
      payloadWidth && payloadHeight ? null : await resolveFrameDimensions(cleanFramePaths[0]);
    const width = payloadWidth ?? inferredDimensions?.width;
    const height = payloadHeight ?? inferredDimensions?.height;
    if (!width || !height) {
      throw new Error('[VideoRender_HUB] Missing width/height and unable to infer from first frame');
    }

    // 2. Invoke EngineHub
    const mergeResult = await apiClient.invokeEngine({
      engineKey: 'video_merge',
      payload: {
        jobId: job.id,
        framePaths: cleanFramePaths,
        fps,
        width,
        height,
      },
      context: { ...job.context, jobId: job.id, traceId },
    });
    logger.log(`[VideoRender_HUB DEBUG] mergeResult=${JSON.stringify(mergeResult)}`);

    const mergeSucceeded =
      (mergeResult as any)?.success === true || (mergeResult as any)?.status === 'SUCCESS';
    if (!mergeSucceeded) {
      const mergeErrorMessage =
        (mergeResult as any)?.error?.message ||
        (mergeResult as any)?.message ||
        'unknown_engine_failure';
      throw new Error(`VIDEO_MERGE_FAIL: ${mergeErrorMessage}`);
    }

    const output = (mergeResult as any).output || {};
    const storageKey = await normalizeStorageKey(
      output.storageKey || output.asset?.uri || output.asset?.storageKey
    );
    const sha256 = output.sha256 || output.asset?.sha256;
    const duration = output.duration || output.asset?.durationSeconds;

    // 3. Upsert Asset
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type_role: {
          role: AssetRole.SCENE_MASTER,
          ownerType: AssetOwnerType.SCENE,
          ownerId: sceneId,
          type: AssetType.VIDEO,
        },
      },
      update: {
        storageKey,
        checksum: sha256,
        createdByJobId: job.id,
        status: 'GENERATED',
      },
      create: {
        projectId,
        ownerId: sceneId,
        ownerType: AssetOwnerType.SCENE,
        role: AssetRole.SCENE_MASTER,
        type: AssetType.VIDEO,
        storageKey,
        checksum: sha256,
        status: 'GENERATED',
        createdByJobId: job.id,
      },
    });

    // 4. Audit Trail
    try {
      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          resourceType: 'scene',
          resourceId: sceneId,
          action: 'ce08.video_render.hub_success',
          orgId: organizationId,
          details: {
            jobId: job.id,
            pipelineRunId,
            storageKey,
            duration,
          },
        },
      });
    } catch (error: any) {
      logger.warn(`[VideoRender_HUB] audit log skipped due to degraded prisma: ${error.message}`);
    }

    return {
      status: 'SUCCEEDED',
      videoKey: storageKey,
      output: { assetId: asset.id, storageKey },
    };
  } catch (error: any) {
    logger.error(`[VideoRender_HUB] Failed: ${error.message}`);
    return { status: 'FAILED', error: error.message };
  }
}
