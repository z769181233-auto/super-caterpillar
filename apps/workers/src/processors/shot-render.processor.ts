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

    // Debug Logs for S-3 Fix
    logger.log(
      `[ShotRender_HUB DEBUG] projectId=${projectId}, sceneId=${shot.sceneId}, shotId=${shotId}`
    );

    // 3. Invoke SHOT_RENDER Engine
    const renderResult = await apiClient.invokeEngine({
      engineKey: 'shot_render',
      payload: {
        prompt: shot.enrichedPrompt,
        shotId: shot.id,
        projectId,
        traceId,
      },
      context: {
        ...job.context,
        jobId: job.id,
        traceId,
        identity: { anchors, mode: 'required' },
        sceneId: shot.sceneId,
      },
    });

    if (renderResult.status !== 'SUCCESS') {
      throw new Error(`RENDER_ENGINE_FAIL: ${renderResult.error?.message}`);
    }

    const output = renderResult.output as any;
    logger.log(`[ShotRender_HUB DEBUG] Raw Output: ${JSON.stringify(output)}`);
    const storageKey = output.storageKey || output.asset?.uri || output.asset?.storageKey;
    const sha256 = output.sha256 || output.asset?.sha256;
    logger.log(`[ShotRender_HUB DEBUG] Extracted storageKey: ${storageKey}, sha256: ${sha256}`);

    if (!storageKey) {
      throw new Error(`RENDER_ENGINE_SUCCESS_BUT_NO_STORAGE_KEY: ${JSON.stringify(output)}`);
    }

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
    const isVideo = (storageKey || '').match(/\.(mp4|mkv|mov|avi)$/i);
    const assetType = isVideo ? AssetType.VIDEO : AssetType.IMAGE;

    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: shot.id,
          ownerType: AssetOwnerType.SHOT,
          type: assetType,
        },
      },
      update: { storageKey, checksum: sha256, status: 'GENERATED', createdByJobId: job.id },
      create: {
        projectId,
        ownerId: shot.id,
        ownerType: AssetOwnerType.SHOT,
        type: assetType,
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

    // W3-1: 原生落盘四件套（禁止 fallback） - PLAN-B Permanent Fix
    const path = await import('node:path');
    const repoRoot = process.env.SCU_REPO_ROOT || process.cwd();
    const artifactDirAbs = payload.artifactDir
      ? path.isAbsolute(payload.artifactDir)
        ? payload.artifactDir
        : path.resolve(repoRoot, payload.artifactDir)
      : process.env.ARTIFACT_DIR
        ? path.resolve(process.env.ARTIFACT_DIR)
        : undefined;

    if (artifactDirAbs) {
      // Safety check: must be inside docs/_evidence
      const allowedBase = path.resolve(repoRoot, 'docs/_evidence');
      const resolved = path.resolve(artifactDirAbs);
      if (!resolved.startsWith(allowedBase + path.sep)) {
        throw new Error(`[W3] artifactDir out of allowed base: ${resolved}`);
      }

      const { dropOriginNativeFourPack } = await import('../lib/origin_native_drop');
      // 从 storageKey 推断本地路径（假设在 .data/storage 下）
      const storagePath = storageKey.startsWith('/')
        ? storageKey
        : path.resolve(repoRoot, 'apps/api/.data/storage', storageKey);

      await dropOriginNativeFourPack({
        artifactDir: artifactDirAbs,
        mp4Path: storagePath,
        meta: {
          shotId,
          jobId: job.id,
          engine: 'shot_render',
          source: { kind: 'storage_key', storageKey },
        },
      });
      logger.log(`[W3-1] Native drop OK: ${artifactDirAbs}/ORIGIN_NATIVE_DROP_OK.txt`);
    }

    return { status: 'SUCCEEDED', output: { assetId: asset.id, storageKey } };
  } catch (error: any) {
    logger.error(`[ShotRender_HUB] Failed: ${error.message}`);
    await prisma.shot
      .update({ where: { id: shotId }, data: { renderStatus: 'FAILED' } })
      .catch(() => {});
    return { status: 'FAILED', error: error.message };
  }
}
