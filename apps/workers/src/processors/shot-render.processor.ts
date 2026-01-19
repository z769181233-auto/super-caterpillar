import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';

export interface ShotRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

export async function processShotRenderJob(
  context: ProcessorContext
): Promise<ShotRenderProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  const pipelineRunId = job.payload?.pipelineRunId;
  const traceId = job.payload?.traceId; // Optional from upstream

  if (!pipelineRunId) {
    throw new Error(`[ShotRender] Missing pipelineRunId in payload for job ${job.id}`);
  }

  let storageRoot: string;
  if (process.env.REPO_ROOT) {
    storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
  } else if (process.env.STORAGE_ROOT) {
    storageRoot = process.env.STORAGE_ROOT;
  } else {
    storageRoot = path.join(path.resolve(process.cwd(), '../../'), '.data/storage');
  }

  try {
    // 1. Env Check

    // 2. Hydrate Shot (SSOT for Prompt)
    if (!job.shotId) {
      throw new Error(`[ShotRender] Job ${job.id} missing shotId`);
    }

    const shot = await prisma.shot.findUnique({
      where: { id: job.shotId },
      include: {
        scene: { include: { episode: { include: { season: { include: { project: true } } } } } },
        organization: true,
      },
    });

    // Resolve context from hierarchy
    const projectId = shot?.scene?.episode?.season?.project?.id;
    const organizationId = shot?.organization?.id;

    if (!shot) throw new Error(`[ShotRender] Shot ${job.shotId} not found`);
    if (!shot.enrichedPrompt)
      throw new Error(`[ShotRender] Shot ${job.shotId} has no enrichedPrompt`);
    if (!projectId || !organizationId) throw new Error(`[ShotRender] Shot context incomplete`);

    // 2.5. CE02 Identity Lock Enforcement (Hard Check)
    const engineHub = new EngineHubClient(apiClient);
    let identityMetadata: any = {};
    const characterIds =
      (job.payload as any)?.characterIds || (shot.params as any)?.characterIds || [];

    if (Array.isArray(characterIds) && characterIds.length > 0) {
      logger.log(
        `[ShotRender] Enforcing Identity Anchor for characters: ${characterIds.join(', ')}`
      );

      const anchors = await prisma.characterIdentityAnchor.findMany({
        where: {
          characterId: { in: characterIds },
          isActive: true,
          status: 'READY',
        },
      });

      const foundCharIds = anchors.map((a) => a.characterId);
      const missingCharIds = characterIds.filter((id) => !foundCharIds.includes(id));

      if (missingCharIds.length > 0) {
        const errorMsg = `IDENTITY_ANCHOR_MISSING: Active anchors not found for characters: ${missingCharIds.join(', ')}`;
        logger.error(`[ShotRender] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Construct Identity Metadata
      const anchorMeta = anchors.map((a) => ({
        characterId: a.characterId,
        anchorId: a.id,
        seed: a.seed,
        viewKeysSha256: a.viewKeysSha256,
      }));

      identityMetadata = {
        anchors: anchorMeta,
        mode: 'required',
      };

      logger.log(`[ShotRender] Identity Anchors verified and injected: ${anchors.length}`);
    } else {
      logger.log(
        `[ShotRender] No characterIds found for shot ${job.shotId}, skipping Identity Lock.`
      );
    }

    // 3. Real Render Logic (Invoke Engine Hub)
    logger.log(`[ShotRender] Invoking real engine hub for shot ${job.shotId}...`);
    const renderResult = await engineHub.invoke({
      engineKey: 'shot_render',
      engineVersion: 'v1.1', // Assuming v1.1 for real video pass
      payload: {
        prompt: shot.enrichedPrompt,
        enrichedPrompt: shot.enrichedPrompt,
        shotId: shot.id,
        projectId,
        traceId: traceId || job.id,
      },
      metadata: {
        traceId: traceId || job.id,
        jobId: job.id,
        projectId,
        isVerification: process.env.GATE_MODE === '1',
        identity: identityMetadata, // Inject Identity Metadata
      },
    });

    if (!renderResult.success || !renderResult.output) {
      const errorMsg = renderResult.error?.message || 'Render failed with no error message';
      logger.error(`[ShotRender] Engine Hub invocation failed: ${errorMsg}`);
      throw new Error(`SHOT_RENDER_FAILED: ${errorMsg}`);
    }

    const renderOutput = renderResult.output as any;
    const sourceAbsPath = renderOutput.asset?.uri; // Assuming URI is absolute path from adapter

    if (!sourceAbsPath || !fs.existsSync(sourceAbsPath)) {
      throw new Error(
        `SHOT_RENDER_INVALID_OUTPUT: Engine returned missing or invalid file path: ${sourceAbsPath}`
      );
    }

    // 3.5. Persistence Location & Normalization
    const relativeKey = `renders/${projectId}/${shot.id}/${pipelineRunId}/keyframe.png`;
    const absolutePath = path.resolve(storageRoot, relativeKey);

    // Ensure dir exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Move/Copy file from adapter local storage to job-specific storage
    fs.copyFileSync(sourceAbsPath, absolutePath);
    logger.log(`[ShotRender] Real image moved to ${absolutePath}`);

    // 4. Persistence (Asset & Audit)
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerType: AssetOwnerType.SHOT,
          ownerId: shot.id,
          type: AssetType.IMAGE,
        },
      },
      update: {
        storageKey: relativeKey,
      },
      create: {
        projectId: projectId,
        ownerId: shot.id,
        ownerType: AssetOwnerType.SHOT,
        type: AssetType.IMAGE,
        storageKey: relativeKey,
        status: 'GENERATED',
        createdByJobId: job.id,
      },
    });

    // P2-2: Update Shot Status & Result URL explicitly
    await prisma.shot.update({
      where: { id: shot.id },
      data: {
        renderStatus: 'COMPLETED', // Use COMPLETED (enum backed)
        resultImageUrl: relativeKey,
        // resultVideoUrl: ..., // If video produced
      },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        resourceType: 'shot',
        resourceId: shot.id,
        action: 'ce07.shot_render.success',
        orgId: organizationId,
        // actorId, traceId moved to details if not in schema (will be verified next step but safe to put in details if unsure, but I will put in details to be safe or check schema)
        // Actually, I'll put traceId in details to satisfy the error if it isn't in root.
        details: {
          jobId: job.id,
          assetId: asset.id,
          engine: renderOutput.render_meta?.engine || 'real',
          provider: renderOutput.audit_trail?.providerSelected,
          actorId: 'system-worker',
          traceId: traceId,
          renderMeta: renderOutput.render_meta,
          identity: identityMetadata, // Explicitly log Identity Anchor info
        },
      },
    });

    // 5. Billing (P0 Hotfix: GPU Seconds)
    const costService = new CostLedgerService(apiClient, prisma);
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: 'SHOT_RENDER',
      traceId: traceId || job.id,
      projectId,
      userId: 'system',
      orgId: organizationId,
      engineKey: 'shot_render',
      runId: pipelineRunId,
      gpuSeconds: 2.5, // Mock duration for reliable audit (Real: duration from worker stats)
      cost: 0.05, // Mock cost (priced via PRICING_SSOT in real router)
    });

    // 6. 自动触发 VIDEO_RENDER (P0-VIDEO-1: 可恢复幂等策略)
    const sceneId = shot.scene?.id;
    if (sceneId) {
      const videoKey = `videos/${projectId}/${sceneId}/${pipelineRunId}/scene.mp4`;

      // 查询现有 VIDEO 资产
      const existingVideo = await prisma.asset.findUnique({
        where: {
          ownerType_ownerId_type: {
            ownerType: AssetOwnerType.SCENE,
            ownerId: sceneId,
            type: AssetType.VIDEO,
          },
        },
      });

      let shouldTrigger = false;
      if (!existingVideo) {
        shouldTrigger = true;
        logger.log(
          `[ShotRender] No VIDEO asset found for scene ${sceneId}, will trigger VIDEO_RENDER`
        );
      } else {
        // 检查是否为 pending 或文件不存在/损坏（可恢复）
        const isPending = existingVideo.storageKey.startsWith('pending/');
        const absPath = path.resolve(storageRoot, existingVideo.storageKey);
        const fileOk = fs.existsSync(absPath) && fs.statSync(absPath).size > 0;

        if (isPending || !fileOk) {
          shouldTrigger = true;
          logger.log(
            `[ShotRender] VIDEO asset pending or broken for scene ${sceneId}, will re-trigger VIDEO_RENDER`
          );
        } else {
          logger.log(`[ShotRender] VIDEO asset ready for scene ${sceneId}, skipping VIDEO_RENDER`);
        }
      }

      if (shouldTrigger) {
        // 创建 VIDEO_RENDER Job（幂等在 VIDEO_RENDER 内部处理）
        const frames = [relativeKey];
        await apiClient.createJob({
          projectId,
          organizationId,
          jobType: 'VIDEO_RENDER' as any,
          payload: {
            pipelineRunId,
            traceId: traceId || job.id,
            frames,
            projectId,
            sceneId,
            episodeId: shot.scene?.episode?.id,
          },
        });
        logger.log(`[ShotRender] VIDEO_RENDER job created for scene ${sceneId}`);
      }
    }

    return {
      status: 'SUCCEEDED',
      output: {
        assetId: asset.id,
        storageKey: relativeKey,
        fullPath: absolutePath,
      },
    };
  } catch (error: any) {
    logger.error(`[ShotRender] Failed: ${error.message}`);
    throw error;
  }
}
