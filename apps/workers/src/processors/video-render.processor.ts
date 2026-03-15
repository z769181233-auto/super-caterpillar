import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';
const { Client } = require('pg');

export interface VideoRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED';
  output?: any;
  videoKey?: string;
  assetId?: string;
  error?: string;
  [key: string]: any;
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
  const { pipelineRunId, projectId, frames, frameKeys } = payload;
  let sceneId = payload.sceneId;

  logger.log(`[VideoRender_HUB] Processing job ${job.id} for run ${pipelineRunId}`);
  const queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  const isPrismaTimeout = (error: any) => String(error?.message || '').includes('PRISMA_QUERY_TIMEOUT');
  const withPgClient = async <T>(fn: (client: any) => Promise<T>): Promise<T> => {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: queryTimeoutMs,
      query_timeout: queryTimeoutMs,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  };

  const upsertAssetViaPg = async (storageKey: string, sha256?: string) =>
    withPgClient(async (client) => {
      const existing = await client.query(
        `SELECT id FROM assets WHERE "ownerType" = $1 AND "ownerId" = $2 AND type = $3 LIMIT 1`,
        [AssetOwnerType.SCENE, sceneId, AssetType.VIDEO]
      );
      if (existing.rows[0]?.id) {
        await client.query(
          `UPDATE assets
             SET "storageKey" = $2,
                 checksum = $3,
                 "createdByJobId" = $4,
                 status = 'GENERATED',
                 "projectId" = COALESCE("projectId", $5)
           WHERE id = $1`,
          [existing.rows[0].id, storageKey, sha256, job.id, projectId]
        );
        return { id: existing.rows[0].id };
      }

      const assetId = randomUUID();
      await client.query(
        `INSERT INTO assets (
           id, "projectId", "createdAt", checksum, "createdByJobId",
           "ownerId", "ownerType", status, "storageKey", type
         ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, 'GENERATED', $7, $8)`,
        [assetId, projectId, sha256, job.id, sceneId, AssetOwnerType.SCENE, storageKey, AssetType.VIDEO]
      );
      return { id: assetId };
    });

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

    const cleanFramePaths = (frames || frameKeys || []).map((raw: string) => {
      const normalized = raw.replace(/^file:\/\//, '').replace(/^.*\.runtime\//, '');
      if (path.isAbsolute(normalized) || !localStorage) return normalized;
      return localStorage.getAbsolutePath(normalized);
    });

    // 2. Invoke EngineHub
    const mergeResult = await apiClient.invokeEngine({
      engineKey: 'video_merge',
      payload: {
        jobId: job.id,
        framePaths: cleanFramePaths,
        fps: payload.fps || 24,
        width: payload.width || 512,
        height: payload.height || 512,
      },
      context: { ...job.context, jobId: job.id, traceId: payload.traceId },
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
    const storageKey = output.storageKey || output.asset?.uri || output.asset?.storageKey;
    const sha256 = output.sha256 || output.asset?.sha256;
    const duration = output.duration || output.asset?.durationSeconds;

    // 3. Upsert Asset
    let asset;
    try {
      asset = await prisma.asset.upsert({
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
    } catch (error: any) {
      if (!isPrismaTimeout(error)) throw error;
      logger.warn(`[VideoRender_HUB] Prisma asset upsert degraded, using pg fallback: ${error.message}`);
      asset = await upsertAssetViaPg(storageKey, sha256);
    }

    // 4. Audit Trail
    try {
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
