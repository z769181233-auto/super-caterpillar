import { PrismaClient, AssetOwnerType, AssetType } from 'database';
// @ts-ignore
import { WorkerJob } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { ApiClient } from '../api-client';
import { CostLedgerService } from '../billing/cost-ledger.service';

export interface ShotRenderProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

export async function processShotRenderJob(context: {
  prisma: PrismaClient;
  job: WorkerJob;
  apiClient: ApiClient;
  logger?: any;
}): Promise<ShotRenderProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  const pipelineRunId = job.payload?.pipelineRunId;
  const traceId = job.payload?.traceId; // Optional from upstream

  if (!pipelineRunId) {
    throw new Error(`[ShotRender] Missing pipelineRunId in payload for job ${job.id}`);
  }

  try {
    // 1. Env Check
    if (process.env.RENDER_ENGINE !== 'mock') {
      throw new Error(`[ShotRender] RENDER_ENGINE must be 'mock' for this processor version.`);
    }

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

    // 3. Mock Render Logic (Generate File)
    const runtimeDir = path.resolve(process.cwd(), '.runtime', 'renders');
    const relativeKey = `renders/${projectId}/${shot.id}/${pipelineRunId}/keyframe.png`;
    const absolutePath = path.resolve(process.cwd(), '.runtime', relativeKey);

    // Ensure dir exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write Dummy File
    const fileContent = `MOCK RENDER - Job: ${job.id}\nPrompt: ${shot.enrichedPrompt.substring(0, 50)}...`;
    fs.writeFileSync(absolutePath, fileContent);

    logger.log(`[ShotRender] Generated mock file at ${absolutePath}`);

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
          engine: 'mock',
          actorId: 'system-worker',
          traceId: traceId,
        },
      },
    });

    // 5. Billing (P0 Hotfix: GPU Seconds)
    const costService = new CostLedgerService(apiClient);
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
      cost: 0.05 // Mock cost (priced via PRICING_SSOT in real router)
    });

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
