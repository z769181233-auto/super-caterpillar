import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import * as path from 'path';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';

export interface VideoRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED';
  output?: any;
  error?: string;
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
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  const payload = (job.payload || {}) as any;
  const { pipelineRunId, projectId, frames, frameKeys } = payload;
  let sceneId = payload.sceneId;

  logger.log(`[VideoRender_HUB] Processing job ${job.id} for run ${pipelineRunId}`);

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

    const cleanFrameKeys = (frames || frameKeys || []).map((k: string) =>
      k.replace(/^file:\/\//, '').replace(/^.*\.runtime\//, '')
    );

    // 2. Invoke EngineHub
    const mergeResult = await apiClient.invokeEngine({
      engineKey: 'video_merge',
      payload: {
        jobId: job.id,
        framePaths: cleanFrameKeys, // Adapter will resolve paths using safeJoin
        fps: payload.fps || 24,
        width: payload.width || 512,
        height: payload.height || 512,
      },
      context: { ...job.context, jobId: job.id, traceId: payload.traceId },
    });

    if (mergeResult.status !== 'SUCCESS') {
      throw new Error(`VIDEO_MERGE_FAIL: ${mergeResult.error?.message}`);
    }

    const { storageKey, sha256, duration } = mergeResult.output;

    // 3. Upsert Asset
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
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
        type: AssetType.VIDEO,
        storageKey,
        checksum: sha256,
        status: 'GENERATED',
        createdByJobId: job.id,
      },
    });

    // 4. Audit Trail
    await prisma.auditLog.create({
      data: {
        id: `audit-vr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        resourceType: 'scene',
        resourceId: sceneId,
        action: 'ce08.video_render.hub_success',
        orgId: (job as any).organizationId || 'unknown',
        details: {
          jobId: job.id,
          pipelineRunId,
          storageKey,
          duration,
        },
      },
    });

    return {
      status: 'SUCCEEDED',
      output: { assetId: asset.id, storageKey },
    };
  } catch (error: any) {
    logger.error(`[VideoRender_HUB] Failed: ${error.message}`);
    return { status: 'FAILED', error: error.message };
  }
}
