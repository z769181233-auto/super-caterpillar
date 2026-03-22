import { AssetOwnerType, AssetType, ReviewResult, ReviewType, PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';

/**
 * Media Security Processor - Hub-only Architecture (PLAN-5)
 * - Removes local FFmpeg watermark/HLS logic.
 * - Delegates to EngineHub (ce09_security).
 * - Handles publishing review & asset updates.
 */
export async function processMediaSecurityJob(context: ProcessorContext) {
  const { prisma, job, apiClient } = context;
  const { assetId, videoAssetStorageKey, pipelineRunId, shotId } = job.payload;
  const projectId = job.projectId || job.payload.projectId;

  if (!projectId) {
    throw new Error('[CE09] Missing projectId');
  }

  try {
    let targetAssetId = assetId;
    let sourceStorageKey = videoAssetStorageKey;
    let resolvedAsset:
      | {
          id: string;
          projectId: string;
          storageKey: string;
          signedUrl: string | null;
          fingerprintId: string | null;
        }
      | null = null;

    // 1. Resolve Asset & Storage Key
    if (targetAssetId) {
      resolvedAsset = await prisma.asset.findUnique({
        where: { id: targetAssetId },
        select: { id: true, projectId: true, storageKey: true, signedUrl: true, fingerprintId: true },
      });

      if (!resolvedAsset) {
        throw new Error(`[CE09] Asset ${targetAssetId} not found`);
      }

      if (resolvedAsset && resolvedAsset.projectId !== projectId) {
        throw new Error(`[CE09] Asset ${targetAssetId} does not belong to project ${projectId}`);
      }

      if (!sourceStorageKey) {
        sourceStorageKey = resolvedAsset?.storageKey;
      }
    } else if (!targetAssetId && shotId) {
      resolvedAsset = await prisma.asset.findUnique({
        where: {
          ownerType_ownerId_type: {
            ownerType: AssetOwnerType.SHOT,
            ownerId: shotId,
            type: AssetType.VIDEO,
          },
        },
        select: { id: true, projectId: true, storageKey: true, signedUrl: true, fingerprintId: true },
      });

      if (resolvedAsset) {
        if (resolvedAsset.projectId !== projectId) {
          throw new Error(
            `[CE09] Shot asset ${resolvedAsset.id} does not belong to project ${projectId}`
          );
        }
        targetAssetId = resolvedAsset.id;
        sourceStorageKey = resolvedAsset.storageKey;
      }
    }

    if (!targetAssetId) {
      throw new Error('[CE09] Missing target asset');
    }
    if (!sourceStorageKey) {
      throw new Error('[CE09] Missing source storage key');
    }

    // 2. Invoke EngineHub
    const secResult = await apiClient.invokeEngine({
      engineKey: 'ce09_security',
      payload: {
        videoPath: sourceStorageKey,
        watermarkText: 'SUPER_CATERPILLAR',
        projectId,
        pipelineRunId,
      },
      context: { ...job.context, jobId: job.id, traceId: job.payload.traceId },
    });

    if (!secResult.success) {
      throw new Error(`SECURITY_ENGINE_FAIL: ${secResult.error?.message || 'Unknown error'}`);
    }

    const { storageKey, hlsPlaylistKey, screenshotKey, framemd5Key, sha256 } = secResult.output;

    // 3. Update Asset
    let fpRecord = resolvedAsset?.fingerprintId
      ? await prisma.securityFingerprint.findUnique({
          where: { id: resolvedAsset.fingerprintId },
        })
      : null;

    if (fpRecord) {
      fpRecord = await prisma.securityFingerprint.update({
        where: { id: fpRecord.id },
        data: {
          assetId: targetAssetId,
          fpVector: { algorithm: 'sha256', hash: sha256 },
        },
      });
    } else {
      fpRecord = await prisma.securityFingerprint.create({
        data: {
          assetId: targetAssetId,
          fpVector: { algorithm: 'sha256', hash: sha256 },
        },
      });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: targetAssetId },
      data: {
        storageKey,
        checksum: sha256,
        status: 'PUBLISHED',
        hlsPlaylistUrl: hlsPlaylistKey,
        signedUrl: resolvedAsset?.signedUrl ?? `/api/assets/${targetAssetId}/secure-url`,
        watermarkMode: 'SCU_VISIBLE_V1_ASYNC',
        fingerprintId: fpRecord.id,
      },
    });

    // 4. Publishing Review
    if (shotId) {
      const reviewUpdate = await prisma.publishingReview.updateMany({
        where: { shotId },
        data: { result: ReviewResult.require_review },
      });

      if (reviewUpdate.count === 0) {
        await prisma.publishingReview.create({
          data: {
            shotId,
            reviewType: ReviewType.semi_auto,
            result: ReviewResult.require_review,
            reviewLog: {},
          },
        });
      }
    }

    // 5. Audit
    await prisma.auditLog.create({
      data: {
        id: `audit-sec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        resourceType: 'asset',
        resourceId: targetAssetId,
        action: 'ce09.media_security.hub_success',
        details: {
          jobId: job.id,
          sha256,
          storageKey,
        },
      },
    });

    return {
      status: 'SUCCEEDED',
      hlsPlaylistUrl: hlsPlaylistKey,
      storageKey,
      fingerprintId: fpRecord.id,
    };
  } catch (error: any) {
    throw error;
  }
}
