import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';
import { sha256File } from '../../../../packages/shared/hash';
import { ensureDir, fileExists } from '../../../../packages/shared/fs_async';
import { runCanonGuard } from '../../../../packages/canon-guard';

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
  const traceId = job.payload?.traceId;

  if (!pipelineRunId) {
    throw new Error(`[ShotRender] Missing pipelineRunId in payload for job ${job.id}`);
  }

  // Resolve Storage Root
  let storageRoot: string;
  if (process.env.REPO_ROOT) {
    storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
  } else if (process.env.STORAGE_ROOT) {
    storageRoot = process.env.STORAGE_ROOT;
  } else {
    storageRoot = path.join(path.resolve(process.cwd(), '../../'), '.data/storage');
  }

  try {
    // 1. Hydrate Shot
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

    if (!shot) throw new Error(`[ShotRender] Shot ${job.shotId} not found`);

    const projectId = shot?.scene?.episode?.season?.project?.id || job.projectId;
    const organizationId = shot?.organization?.id || job.organizationId;
    if (!projectId || !organizationId)
      throw new Error(
        `[ShotRender] Shot context incomplete: proj=${projectId}, org=${organizationId}`
      );

    // 2. Identity Anchor Logic (Multi-Character Ready)
    const characterIds =
      (job.payload as any)?.characterIds || (shot.params as any)?.characterIds || [];
    let identityMetadata: any = {};

    const anchors = await prisma.characterIdentityAnchor.findMany({
      where: {
        characterId: { in: characterIds },
        isActive: true,
        status: 'READY',
      },
    });

    if (characterIds.length > 0) {
      const missingCharIds = characterIds.filter(
        (id: string) => !anchors.some((a) => a.characterId === id)
      );
      if (missingCharIds.length > 0) {
        throw new Error(`IDENTITY_ANCHOR_MISSING: ${missingCharIds.join(', ')}`);
      }
      identityMetadata = {
        anchors: anchors.map((a) => ({
          characterId: a.characterId,
          anchorId: a.id,
          seed: a.seed,
          viewKeysSha256: a.viewKeysSha256,
        })),
        mode: 'required',
      };
    }

    // 3. Engine Invocation
    const engineHub = new EngineHubClient(apiClient);
    const renderResult = await engineHub.invoke({
      engineKey: 'shot_render',
      engineVersion: 'v1.1',
      payload: {
        prompt: shot.enrichedPrompt,
        shotId: shot.id,
        projectId,
        traceId: traceId || job.id,
      },
      metadata: {
        traceId: traceId || job.id,
        jobId: job.id,
        projectId,
        identity: identityMetadata,
      },
    });

    if (!renderResult.success || !renderResult.output) {
      throw new Error(`SHOT_RENDER_FAILED: ${renderResult.error?.message || 'No error message'}`);
    }

    const renderOutput = renderResult.output as any;
    const sourceAbsPath = renderOutput.asset?.uri;
    if (!sourceAbsPath || !(await fileExists(sourceAbsPath))) {
      throw new Error(`SHOT_RENDER_INVALID_OUTPUT: Missing file at ${sourceAbsPath}`);
    }

    // 4. Persistence & Normalization (Async IO Only)
    const relativeKey = `renders/${projectId}/${shot.id}/${pipelineRunId}/keyframe.png`;
    const absolutePath = path.resolve(storageRoot, relativeKey);
    const auditDir = path.join(path.dirname(absolutePath), 'audit');

    await ensureDir(path.dirname(absolutePath));
    await fsp.copyFile(sourceAbsPath, absolutePath);

    // Constant Memory Checksum
    const checksum = await sha256File(absolutePath);

    // 5. [P3'-4] REAL Canon Guard (Multi-Character + SSOT + Report)
    const canonFreezePath = path.join(
      process.env.REPO_ROOT || process.cwd(),
      'docs/_specs/CANON_FREEZE.json'
    );
    const canonResult = await runCanonGuard({
      shotId: shot.id,
      projectId,
      organizationId,
      characterIds,
      imagePath: absolutePath,
      auditDir,
      canonFreezePath,
      identityAnchors: anchors.map((a) => ({
        characterId: a.characterId,
        anchorId: a.id,
        viewKeysSha256: a.viewKeysSha256 ?? undefined,
      })),
    });

    if (!canonResult.passed) {
      // Close state as FAILED before throwing
      await prisma.shot.update({
        where: { id: shot.id },
        data: { renderStatus: 'FAILED' },
      });

      await prisma.auditLog.create({
        data: {
          id: `audit-canon-fail-${Date.now()}`,
          resourceType: 'shot',
          resourceId: shot.id,
          action: 'ce07.canon_gate.blocked',
          orgId: organizationId,
          details: {
            jobId: job.id,
            reasons: canonResult.reasons,
            reportPath: canonResult.reportPath,
          },
        },
      });

      throw new Error(`CANON_GATE_FAIL: ${canonResult.reasons.join(', ')}`);
    }

    // 6. Finalize Success
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: shot.id,
          ownerType: AssetOwnerType.SHOT,
          type: AssetType.IMAGE,
        },
      },
      update: { storageKey: relativeKey, checksum, status: 'GENERATED' },
      create: {
        projectId,
        ownerId: shot.id,
        ownerType: AssetOwnerType.SHOT,
        type: AssetType.IMAGE,
        storageKey: relativeKey,
        status: 'GENERATED',
        createdByJobId: job.id,
        checksum,
      },
    });

    await prisma.shot.update({
      where: { id: shot.id },
      data: { renderStatus: 'COMPLETED', resultImageUrl: relativeKey },
    });

    // 7. Auto-trigger VIDEO_RENDER (Logic simplified for brevity, maintaining robustness)
    const sceneId = shot.sceneId; // Direct field
    if (sceneId) {
      await apiClient.createJob({
        projectId,
        organizationId,
        jobType: 'VIDEO_RENDER' as any,
        payload: {
          pipelineRunId,
          traceId: traceId || job.id,
          frames: [relativeKey],
          projectId,
          sceneId,
          episodeId: shot.scene?.episodeId,
        },
      });
    }

    return { status: 'SUCCEEDED', output: { assetId: asset.id, storageKey: relativeKey } };
  } catch (error: any) {
    logger.error(`[ShotRender] Failed: ${error.message}`);
    // Ensure status is marked failed if not already handled
    try {
      if (job.shotId) {
        await prisma.shot
          .update({ where: { id: job.shotId }, data: { renderStatus: 'FAILED' } })
          .catch(() => {});
      }
    } catch (e) {}
    throw error;
  }
}
