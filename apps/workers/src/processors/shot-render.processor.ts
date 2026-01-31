import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';

export interface ShotRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

/**
 * Shot Render Processor - Hub-only Architecture (PLAN-5)
 * - Removes local FFmpeg/Sharp/Canon logic.
 * - Delegates to EngineHub (shot_render + ce23).
 * - Handles identity consistency and asset lifecycle.
 */
export async function processShotRenderJob(
  context: ProcessorContext
): Promise<ShotRenderProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const payload = (job.payload || {}) as any;
  const { pipelineRunId, shotId, projectId } = payload;
  const traceId = payload.traceId || job.id;

  logger.log(`[ShotRender_HUB] Processing job ${job.id} for shot ${shotId}`);

  try {
    // 1. Hydrate Shot Context
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: { include: { episode: { include: { season: { include: { project: true } } } } } },
      },
    });
    if (!shot) throw new Error('SHOT_NOT_FOUND');

    // 2. Identity Anchor Preparation
    const characterIds = payload.characterIds || (shot.params as any)?.characterIds || [];
    const anchors = await prisma.characterIdentityAnchor.findMany({
      where: { characterId: { in: characterIds }, isActive: true, status: 'READY' },
    });

    // 3. Invoke SHOT_RENDER Engine
    const renderResult = await apiClient.invokeEngine({
      engineKey: 'shot_render',
      payload: {
        prompt: shot.enrichedPrompt,
        shotId: shot.id,
        projectId,
        traceId,
      },
      context: { ...job.context, jobId: job.id, traceId, identity: { anchors, mode: 'required' } },
    });

    if (renderResult.status !== 'SUCCESS') {
      throw new Error(`RENDER_ENGINE_FAIL: ${renderResult.error?.message}`);
    }

    const { storageKey, sha256 } = renderResult.output;

    // 4. Invoke CE23 Identity Consistency Check (if characterIds present)
    if (anchors.length > 0) {
      for (const anchor of anchors) {
        logger.log(`[ShotRender_HUB] Verifying identity consistency for ${anchor.characterId}`);
        const ce23Result = await apiClient.invokeEngine({
          engineKey: 'ce23_identity_consistency',
          payload: {
            anchorImageKey: anchor.viewKeyFront,
            targetImageKey: storageKey,
            characterId: anchor.characterId,
          },
          context: { ...job.context, jobId: job.id, traceId },
        });

        if (ce23Result.status !== 'SUCCESS') {
          throw new Error(`CE23_VERIFY_FAIL: ${ce23Result.error?.message}`);
        }
        if (!ce23Result.output.is_consistent) {
          throw new Error(
            `IDENTITY_INCONSISTENT: ${anchor.characterId} score=${ce23Result.output.identity_score}`
          );
        }
      }
    }

    // 5. Success Persistence
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: shot.id,
          ownerType: AssetOwnerType.SHOT,
          type: AssetType.IMAGE,
        },
      },
      update: { storageKey, checksum: sha256, status: 'GENERATED', createdByJobId: job.id },
      create: {
        projectId,
        ownerId: shot.id,
        ownerType: AssetOwnerType.SHOT,
        type: AssetType.IMAGE,
        storageKey,
        checksum: sha256,
        status: 'GENERATED',
        createdByJobId: job.id,
      },
    });

    await prisma.shot.update({
      where: { id: shot.id },
      data: { renderStatus: 'COMPLETED', resultImageUrl: storageKey },
    });

    // 6. Trigger VIDEO_RENDER
    if (shot.sceneId) {
      await apiClient.createJob({
        projectId,
        organizationId: shot.organizationId || 'system',
        jobType: 'VIDEO_RENDER' as any,
        payload: {
          pipelineRunId,
          traceId,
          frames: [storageKey],
          projectId,
          sceneId: shot.sceneId,
          episodeId: shot.scene?.episodeId,
        },
      });
    }

    return { status: 'SUCCEEDED', output: { assetId: asset.id, storageKey } };
  } catch (error: any) {
    logger.error(`[ShotRender_HUB] Failed: ${error.message}`);
    await prisma.shot
      .update({ where: { id: shotId }, data: { renderStatus: 'FAILED' } })
      .catch(() => { });
    return { status: 'FAILED', error: error.message };
  }
}
