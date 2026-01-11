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

interface CE06Context {
  prisma: PrismaClient;
  job: WorkerJob;
  apiClient: ApiClient;
  logger?: any;
}

export async function processCE06NovelParsingJob(context: CE06Context): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  try {
    // 1. Context Hydration
    const fullJob = await prisma.shotJob.findUnique({
      where: { id: job.id },
      include: { shot: true },
    });

    if (!fullJob) throw new Error(`Job ${job.id} not found`);
    const jobOrgId = fullJob.organizationId || fullJob.shot?.organizationId;

    const projectId = fullJob.projectId;
    const episodeId = fullJob.episodeId;
    const sceneId = fullJob.sceneId;

    // 2. Logic (Mock)
    const parsedData = { chapters: 1, scenes: 1 };

    // 3. Orchestration (Trigger CE03)
    // S4-2: CE06 -> CE03
    const traceId = job.payload?.traceId;
    const pipelineRunId = job.payload?.pipelineRunId;

    if (projectId && jobOrgId && job.shotId) {
      const existingCE03 = await prisma.shotJob.findFirst({
        where: {
          projectId,
          organizationId: jobOrgId,
          shotId: job.shotId,
          type: 'CE03_VISUAL_DENSITY',
          payload: {
            path: ['pipelineRunId'],
            equals: pipelineRunId,
          },
        },
      });

      if (!existingCE03) {
        await prisma.shotJob.create({
          data: {
            projectId,
            organizationId: jobOrgId,
            episodeId: episodeId,
            sceneId: sceneId,
            shotId: job.shotId,
            type: 'CE03_VISUAL_DENSITY',
            status: 'PENDING',
            payload: {
              rootJobId: job.payload?.rootJobId,
              precedingJobId: job.id,
              pipelineRunId,
              traceId,
            },
          },
        });
        logger.log(`[CE06] Spawned CE03`);
      }
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        resourceType: 'shot',
        resourceId: job.shotId || 'unknown',
        action: 'ce06.novel_parsing.success',
        orgId: jobOrgId,
        details: {
          jobId: job.id,
          traceId,
          pipelineRunId,
          actorId: 'system-worker',
        },
      },
    });

    return {
      status: 'SUCCEEDED',
      output: parsedData,
    };
  } catch (error: any) {
    logger.error(`[CE06] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: error.message,
    };
  }
}
