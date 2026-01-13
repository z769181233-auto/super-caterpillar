import { JobType } from 'database';
import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
// @ts-ignore
import { WorkerJob } from '../types';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

interface CE03Context {
  prisma: PrismaClient;
  job: WorkerJob;
  apiClient: ApiClient;
  logger?: any;
}

export async function processCE03VisualDensityJob(context: CE03Context): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  try {
    // 1. Context Hydration (S4-2 fix)
    // Fetch full job with relations needed for context propagation
    const fullJob = await prisma.shotJob.findUnique({
      where: { id: job.id },
      include: {
        shot: {
          include: {
            scene: {
              include: {
                episode: true,
              },
            },
          },
        },
      },
    });

    if (!fullJob) throw new Error(`Job ${job.id} not found`);

    // Resolve Org ID (Priority: Job -> Shot -> Default)
    const jobOrgId = fullJob.organizationId || fullJob.shot?.organizationId;
    if (!jobOrgId) {
      logger.warn(`[CE03] No Organization ID found for job ${job.id}`);
    }

    // Resolve Hierarchy IDs for downstream S4-2 pipeline
    const episodeId = fullJob.episodeId || fullJob.shot?.scene?.episodeId;
    const sceneId = fullJob.sceneId || fullJob.shot?.sceneId;
    const projectId = fullJob.projectId;

    // 2. Logic (Simulate Density Calculation)
    // In real impl, this calls python engine.
    // For S4-2, we just produce a mock score and persist.

    const densityScore = Math.random() * 100;

    // 3. Persistence (Shot.qualityScore)
    if (job.shotId) {
      await prisma.shot.update({
        where: { id: job.shotId },
        data: {
          qualityScore: {
            visualDensity: densityScore,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // 4. Trace Propagation & Audit
    const traceId = job.payload?.traceId;
    const pipelineRunId = job.payload?.pipelineRunId;

    await prisma.auditLog.create({
      data: {
        resourceType: 'shot',
        resourceId: job.shotId || 'unknown',
        action: 'ce03.visual_density.success',
        orgId: jobOrgId,
        // actorId, traceId in details
        details: {
          jobId: job.id,
          score: densityScore,
          traceId,
          pipelineRunId,
          actorId: 'system-worker',
        },
      },
    });

    // 4.5 Persist QualityMetrics (S3-C Standard)
    await prisma.qualityMetrics.create({
      data: {
        projectId,
        engine: 'CE03',
        jobId: job.id,
        traceId,
        visualDensityScore: densityScore,
        metadata: {
          densityScore,
          pipelineRunId,
        },
      },
    });

    // 4.6 Billing (P0 Hotfix: 0-cost Audit Record)
    // Even if cost is 0, we must record it for commercial audit trails.
    const costService = new CostLedgerService(apiClient);
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: 'CE03_VISUAL_DENSITY',
      traceId: traceId || job.id,
      projectId,
      userId: 'system', // or derived from job
      orgId: jobOrgId,
      engineKey: 'ce03_visual_density',
      runId: pipelineRunId as string,
      billingUsage: {
        totalTokens: 0,
        completionTokens: 0,
        promptTokens: 0,
        model: 'heuristic-v1'
      },
      cost: 0 // Explicit 0 cost for pure router-based heuristic
    });

    // 5. Orchestration (Trigger CE04)
    // S4-2 Requirement: CE03 -> CE04
    if (job.shotId && projectId && jobOrgId) {
      // Idempotency Check
      const existingCE04 = await prisma.shotJob.findFirst({
        where: {
          projectId,
          organizationId: jobOrgId,
          shotId: job.shotId,
          type: 'CE04_VISUAL_ENRICHMENT',
          payload: {
            path: ['pipelineRunId'],
            equals: pipelineRunId,
          },
        },
      });

      if (!existingCE04) {
        const ce04Job = await prisma.shotJob.create({
          data: {
            projectId,
            organizationId: jobOrgId,
            episodeId: episodeId,
            sceneId: sceneId,
            shotId: job.shotId,
            type: 'CE04_VISUAL_ENRICHMENT',
            status: 'PENDING',
            payload: {
              rootJobId: job.payload?.rootJobId,
              precedingJobId: job.id,
              pipelineRunId,
              traceId,
            },
          },
        });
        logger.log(`[CE03] Spawned CE04: ${ce04Job.id}`);
      } else {
        logger.log(`[CE03] CE04 already exists for run ${pipelineRunId}, skipping spawn.`);
      }
    }

    return {
      status: 'SUCCEEDED',
      output: {
        densityScore,
        metrics: { score: densityScore },
        billing_usage: { totalTokens: 0, model: 'heuristic-v1', cost: 0 } // Standardize Output
      },
    };
  } catch (error: any) {
    logger.error(`[CE03] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: error.message,
    };
  }
}
