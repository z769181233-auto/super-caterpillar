import { JobType } from 'database';
import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

export async function processCE04VisualEnrichmentJob(
  context: ProcessorContext
): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  try {
    // 1. Hydrate Context
    const fullJob = await prisma.shotJob.findUnique({
      where: { id: job.id },
      include: { shot: true },
    });

    if (!fullJob) throw new Error(`Job ${job.id} not found`);
    const jobOrgId = fullJob.organizationId || fullJob.shot?.organizationId;

    // Hierarchy Context
    const projectId = fullJob.projectId;
    const episodeId = fullJob.episodeId;
    const sceneId = fullJob.sceneId;

    // 2. Logic (Simulate Enrichment)
    const enrichedPrompt = `Enriched: ${fullJob.shot?.enrichedPrompt || 'cyberpunk heavy rain'}`;

    // 3. Persistence
    if (job.shotId) {
      await prisma.shot.update({
        where: { id: job.shotId },
        data: {
          enrichedPrompt,
        },
      });
    }

    const traceId = job.payload?.traceId;
    const pipelineRunId = job.payload?.pipelineRunId;

    // 4. Audit
    await prisma.auditLog.create({
      data: {
        resourceType: 'shot',
        resourceId: job.shotId || 'unknown',
        action: 'ce04.visual_enrichment.success',
        orgId: jobOrgId || 'default-org',
        details: {
          jobId: job.id,
          traceId,
          pipelineRunId,
          actorId: 'system-worker',
        },
      },
    });

    // 4.5 Billing (P0 Hotfix)
    const costService = new CostLedgerService(apiClient, prisma);
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: 'CE04_VISUAL_ENRICHMENT',
      traceId: (traceId as string) || job.id,
      projectId,
      userId: 'system',
      orgId: jobOrgId || 'default-org',
      engineKey: 'ce04_visual_enrichment',
      runId: pipelineRunId as string,
      billingUsage: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        model: 'enrichment-v1-mock',
      },
      cost: 0, // Router-based cost (currently free)
    });

    // 5. Spawn SHOT_RENDER (S4-3)
    // Idempotency: Duplicate check for SHOT_RENDER in this run
    const shotId = job.shotId || (job.payload as any)?.shotId || (job.payload as any)?.metadata?.shotId;
    logger.log(`[CE04_DEBUG] Spawning check. ID=${job.id} ShotId=${shotId} PLRunId=${pipelineRunId} Scope=${JSON.stringify({ projectId, jobOrgId })}`);

    if (projectId && jobOrgId && shotId) {
      const validPipelineRunId = pipelineRunId || fullJob.traceId || traceId || `fallback_run_${job.id}`;

      const existingRender = await prisma.shotJob.findFirst({
        where: {
          projectId,
          organizationId: jobOrgId,
          shotId: shotId,
          type: 'SHOT_RENDER',
          payload: {
            path: ['pipelineRunId'],
            equals: validPipelineRunId,
          },
        },
      });

      if (existingRender) {
        await prisma.auditLog.create({
          data: {
            resourceType: 'job',
            resourceId: existingRender.id,
            action: 'ce04.spawn.shot_render.skipped',
            orgId: jobOrgId || 'default-org',
            details: {
              reason: 'idempotency_hit',
              existingJobId: existingRender.id,
              pipelineRunId: validPipelineRunId,
              traceId,
              actorId: 'system-worker',
            },
          },
        });
      } else {
        const renderJob = await prisma.shotJob.create({
          data: {
            projectId,
            organizationId: jobOrgId,
            episodeId: episodeId,
            sceneId: sceneId,
            shotId: shotId,
            type: 'SHOT_RENDER',
            status: 'PENDING',
            payload: {
              rootJobId: job.payload?.rootJobId,
              sourceJobId: job.id,
              pipelineRunId: validPipelineRunId,
              traceId: fullJob.traceId,
            },
            traceId: fullJob.traceId,
          },
        });

        await prisma.auditLog.create({
          data: {
            resourceType: 'job',
            resourceId: renderJob.id,
            action: 'ce04.spawn.shot_render',
            orgId: jobOrgId || 'default-org',
            details: {
              renderJobId: renderJob.id,
              ce04JobId: job.id,
              pipelineRunId,
              traceId,
              actorId: 'system-worker',
            },
          },
        });
      }
    }

    return {
      status: 'SUCCEEDED',
      output: {
        model: 'enrichment-v1-mock',
        version: '1.0.0',
        enrichedPrompt,
        nextStep: 'SHOT_RENDER',
      },
    };
  } catch (error: any) {
    logger.error(`[CE04] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: error.message,
    };
  }
}
