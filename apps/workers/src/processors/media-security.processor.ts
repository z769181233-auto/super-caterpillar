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
  const { assetId, videoAssetStorageKey, pipelineRunId, shotId, projectId } = job.payload;

  console.log(`[MediaSecurity_HUB] Processing job ${job.id}. AssetId=${assetId}`);

  try {
    let targetAssetId = assetId;
    let sourceStorageKey = videoAssetStorageKey;

    // 1. Resolve Asset
    if (!targetAssetId && shotId) {
      const asset = await prisma.asset.findUnique({
        where: {
          ownerType_ownerId_type: {
            ownerType: AssetOwnerType.SHOT,
            ownerId: shotId,
            type: AssetType.VIDEO,
          },
        },
      });
      if (asset) {
        targetAssetId = asset.id;
        sourceStorageKey = asset.storageKey;
      }
    }

    if (!targetAssetId || !sourceStorageKey) {
      throw new Error('MISSING_ASSET_OR_STORAGE_KEY');
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

    if (secResult.status !== 'SUCCESS') {
      throw new Error(`SECURITY_ENGINE_FAIL: ${secResult.error?.message}`);
    }

    const { storageKey, hlsPlaylistKey, screenshotKey, framemd5Key, sha256 } = secResult.output;

    // 3. Update Asset
    let fpRecord = await prisma.securityFingerprint.findFirst({
      where: { assetId: targetAssetId },
    });

    if (!fpRecord) {
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
        signedUrl: `/api/assets/signed-url?key=${storageKey}&t=${Date.now()}`,
        watermarkMode: 'SCU_VISIBLE_V1_ASYNC',
        fingerprintId: fpRecord.id,
      },
    });

    // 4. Publishing Review
    if (shotId) {
      const existingReview = await prisma.publishingReview.findFirst({
        where: { shotId },
      });

      if (existingReview) {
        await prisma.publishingReview.update({
          where: { id: existingReview.id },
          data: { result: ReviewResult.require_review },
        });
      } else {
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
    console.error(`[MediaSecurity_HUB] Failed: ${error.message}`);
    throw error;
  }
}
