import { JobType } from 'database';
import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
// @ts-ignore
import { WorkerJob } from '../types';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

interface CE04Context {
  prisma: PrismaClient;
  job: WorkerJob;
  apiClient: ApiClient;
  logger?: any;
}

export async function processCE04VisualEnrichmentJob(
  context: CE04Context
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
        orgId: jobOrgId,
        details: {
          jobId: job.id,
          traceId,
          pipelineRunId,
          actorId: 'system-worker',
        },
      },
    });

    // 5. Spawn SHOT_RENDER (S4-3)
    // Idempotency: Duplicate check for SHOT_RENDER in this run
    if (projectId && jobOrgId && job.shotId) {
      const existingRender = await prisma.shotJob.findFirst({
        where: {
          projectId,
          organizationId: jobOrgId,
          shotId: job.shotId,
          type: 'SHOT_RENDER',
          payload: {
            path: ['pipelineRunId'],
            equals: pipelineRunId,
          },
        },
      });

      if (existingRender) {
        await prisma.auditLog.create({
          data: {
            resourceType: 'job',
            resourceId: existingRender.id,
            action: 'ce04.spawn.shot_render.skipped',
            orgId: jobOrgId,
            details: {
              reason: 'idempotency_hit',
              existingJobId: existingRender.id,
              pipelineRunId,
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
            shotId: job.shotId,
            type: 'SHOT_RENDER',
            status: 'PENDING',
            payload: {
              rootJobId: job.payload?.rootJobId,
              sourceJobId: job.id,
              pipelineRunId,
              traceId,
            },
          },
        });

        await prisma.auditLog.create({
          data: {
            resourceType: 'job',
            resourceId: renderJob.id,
            action: 'ce04.spawn.shot_render',
            orgId: jobOrgId,
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
