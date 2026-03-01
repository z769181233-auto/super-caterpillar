import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { JobType } from 'database';
import { CEDagRunRequest, CEDagRunResult, CEDagJobIds } from './ce-dag.types';
import { PRODUCTION_MODE } from '@scu/config';
import { BadRequestException } from '@nestjs/common';

/**
 * CE DAG Orchestrator Service
 * Phase 2: Orchestrator (single entry point)
 *
 * Orchestrates CE06→CE03→CE04 pipeline with:
 * - traceId propagation (UUID-based)
 * - runId防污染 (UUID-based)
 * - Real data dependency: CE06→CE03→CE04
 * - Error strategy: any ERROR terminates pipeline; WARNING recorded but non-blocking
 */
@Injectable()
export class CEDagOrchestratorService {
  private readonly logger = new Logger(CEDagOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) {}

  /**
   * Run full CE DAG: CE06 → CE03 → CE04 → SHOT_RENDERs → VIDEO_RENDER
   * Returns result with all job IDs, scores and produced video info
   */
  async runCEDag(req: CEDagRunRequest): Promise<CEDagRunResult> {
    const startedAtIso = new Date().toISOString();

    // 1. Generate runId/traceId if not provided (using UUID)
    const runId = req.runId || randomUUID();
    const traceId = req.traceId || `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // 1.5. Production Guard: referenceSheetId is required for rendering
    if (PRODUCTION_MODE && !req.referenceSheetId) {
      throw new BadRequestException({
        code: 'REFERENCE_SHEET_REQUIRED',
        message:
          'Production mode requires referenceSheetId for the full pipeline (SHOT_RENDER stage).',
      });
    }

    // 2. Get project for organizationId/ownerId
    const project = await this.prisma.project.findUnique({
      where: { id: req.projectId },
      select: { organizationId: true, ownerId: true },
    });

    if (!project?.organizationId) {
      throw new Error(`Project ${req.projectId} missing organizationId`);
    }

    const userId = project.ownerId || 'system';
    const orgId = project.organizationId;

    const jobIds: CEDagJobIds = { shotRenderJobIds: [] };
    const warningsCount = 0;

    this.logger.log(
      `[CE_DAG] Starting Full Pipeline runId=${runId}, traceId=${traceId}, project=${req.projectId}, shot=${req.shotId}`
    );

    try {
      // == Phase 1: Heavy Analysis (CE06 -> CE03 -> CE04) ==

      // 3. Trigger CE06 job (novel parsing)
      // Aligned with Phase 1 Realization: uses createCECoreJob
      const ce06Job = await this.jobService.createCECoreJob({
        projectId: req.projectId,
        organizationId: orgId,
        jobType: JobType.CE06_NOVEL_PARSING,
        payload: {
          raw_text: req.rawText,
          novelSourceId: req.novelSourceId,
          runId,
          engineKey: 'ce06_novel_parsing',
        },
        traceId,
      });
      jobIds.ce06JobId = ce06Job.id;
      await this.waitForJobCompletion(ce06Job.id, 'CE06');

      // 4. Get Scene Context for CE03/04
      const anchorShot = await this.prisma.shot.findUnique({
        where: { id: req.shotId },
        include: { scene: true },
      });
      if (!anchorShot) throw new Error(`Shot ${req.shotId} not found`);
      const sceneId = anchorShot.sceneId;

      // Locate corresponding Scene
      const novelScene = await this.prisma.scene.findFirst({
        where: {
          chapter: {
            novelSource: { projectId: req.projectId },
          },
          sceneIndex: anchorShot.scene.sceneIndex,
        },
      });

      const structuredText =
        novelScene?.enrichedText || 'A cinematic scene based on ' + (anchorShot.title || 'novel');

      // 5. Trigger CE03 job
      const ce03Job = await this.jobService.createCECoreJob({
        projectId: req.projectId,
        organizationId: orgId,
        jobType: JobType.CE03_VISUAL_DENSITY,
        payload: {
          structured_text: structuredText,
          runId,
          engineKey: 'ce03_visual_density',
        },
        traceId,
      });
      jobIds.ce03JobId = ce03Job.id;
      await this.waitForJobCompletion(ce03Job.id, 'CE03');

      // 6. Get CE03 score
      const ce03Metrics = await this.prisma.qualityMetrics.findFirst({
        where: { projectId: req.projectId, engine: 'CE03', jobId: jobIds.ce03JobId, traceId },
        orderBy: { createdAt: 'desc' },
      });
      const ce03Score = ce03Metrics?.visualDensityScore ?? 0;

      // 7. Trigger CE04 job
      const ce04Job = await this.jobService.createCECoreJob({
        projectId: req.projectId,
        organizationId: orgId,
        jobType: JobType.CE04_VISUAL_ENRICHMENT,
        payload: {
          structured_text: structuredText,
          runId,
          engineKey: 'ce04_visual_enrichment',
        },
        traceId,
      });
      this.logger.log(`[CE_DAG] [DEBUG] Triggering CE04 jobId=${ce04Job.id}`);
      jobIds.ce04JobId = ce04Job.id;
      await this.waitForJobCompletion(ce04Job.id, 'CE04');
      this.logger.log(`[CE_DAG] [DEBUG] CE04 finished`);

      // 8. Get CE04 score
      this.logger.log(`[CE_DAG] [DEBUG] Fetching CE04 metrics for jobId=${jobIds.ce04JobId}`);
      const ce04Metrics = await this.prisma.qualityMetrics.findFirst({
        where: { projectId: req.projectId, engine: 'CE04', jobId: jobIds.ce04JobId, traceId },
        orderBy: { createdAt: 'desc' },
      });
      const ce04Score = ce04Metrics?.enrichmentQuality ?? 0;
      this.logger.log(`[CE_DAG] [DEBUG] CE04 score: ${ce04Score}`);

      // == Phase 2: Content Production (SHOT_RENDERs -> TIMELINE) ==

      // 9. Resolve all shots in the same scene
      this.logger.log(`[CE_DAG] [DEBUG] Fetching scene shots for sceneId=${sceneId}`);
      const sceneShots = await this.prisma.shot.findMany({
        where: { sceneId },
        orderBy: { index: 'asc' },
      });

      this.logger.log(`[CE_DAG] Triggering SHOT_RENDER for ${sceneShots.length} shots`);

      // 10. Trigger Parallel SHOT_RENDER
      const renderJobs = await Promise.all(
        sceneShots.map((s) =>
          this.jobService.create(
            s.id,
            {
              type: JobType.SHOT_RENDER,
              payload: {
                runId,
                referenceSheetId: req.referenceSheetId,
              },
              traceId,
            },
            userId,
            orgId
          )
        )
      );
      jobIds.shotRenderJobIds = renderJobs.map((j) => j.id);
      await this.waitForJobsCompletion(jobIds.shotRenderJobIds, 'SHOT_RENDER');

      // 11. Trigger TIMELINE_COMPOSE
      this.logger.log(
        `[CE_DAG] All shots rendered. Triggering PIPELINE_TIMELINE_COMPOSE for scene ${sceneId}`
      );
      const composeJob = await this.jobService.createCECoreJob({
        projectId: req.projectId,
        organizationId: orgId,
        jobType: JobType.PIPELINE_TIMELINE_COMPOSE,
        payload: { sceneId, runId },
        traceId,
      });
      jobIds.timelineComposeJobId = composeJob.id;
      await this.waitForJobCompletion(composeJob.id, 'TIMELINE_COMPOSE');

      const finalComposeJob = await this.prisma.shotJob.findUnique({
        where: { id: composeJob.id },
      });
      const timelineStorageKey = (finalComposeJob?.result as any)?.output?.timelineStorageKey;
      if (!timelineStorageKey)
        throw new Error('Timeline Compose failed to produce timelineStorageKey');

      // 12. Trigger TIMELINE_PREVIEW (CE11)
      this.logger.log(
        `[CE_DAG] Timeline composed at ${timelineStorageKey}. Triggering TIMELINE_PREVIEW`
      );
      const previewJob = await this.jobService.createCECoreJob({
        projectId: req.projectId,
        organizationId: orgId,
        jobType: JobType.TIMELINE_PREVIEW,
        payload: { timelineStorageKey, pipelineRunId: runId },
        traceId,
      });
      jobIds.timelinePreviewJobId = previewJob.id;
      await this.waitForJobCompletion(previewJob.id, 'TIMELINE_PREVIEW', 180000);

      // 13. Extract final preview information
      const finalPreviewJob = await this.prisma.shotJob.findUnique({
        where: { id: previewJob.id },
      });
      const previewUrl =
        (finalPreviewJob?.result as any)?.output?.hls_playlist_url ||
        (finalPreviewJob?.result as any)?.output?.storageKey;

      const finishedAtIso = new Date().toISOString();
      this.logger.log(`[CE_DAG] FULL SUCCESS: runId=${runId}, previewUrl=${previewUrl}`);

      return {
        runId,
        traceId,
        ce06JobId: jobIds.ce06JobId!,
        ce03JobId: jobIds.ce03JobId!,
        ce04JobId: jobIds.ce04JobId!,
        shotRenderJobIds: jobIds.shotRenderJobIds,
        timelineComposeJobId: jobIds.timelineComposeJobId,
        timelinePreviewJobId: jobIds.timelinePreviewJobId,
        previewUrl,
        ce03Score,
        ce04Score,
        warningsCount,
        startedAtIso,
        finishedAtIso,
      };
    } catch (error: any) {
      this.logger.error(
        `[CE_DAG] [DEBUG] CAUGHT ERROR in runCEDag: ${error?.message || 'No message'}`,
        error?.stack
      );
      this.logger.error(`[CE_DAG] FAILED: runId=${runId}, error=${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for job to reach terminal status
   */
  private async waitForJobCompletion(
    jobId: string,
    jobLabel: string,
    timeoutMs?: number
  ): Promise<void> {
    // Allow override via env (for gate testing on slow machines)
    if (!timeoutMs) {
      const parsed = Number(process.env.CE_DAG_JOB_TIMEOUT_MS ?? 60000);
      timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
      this.logger.log(
        `[CE_DAG] job wait timeout=${timeoutMs}ms (env:${process.env.CE_DAG_JOB_TIMEOUT_MS ?? 'default'})`
      );
    }
    const startTime = Date.now();
    const pollIntervalMs = 1000;

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
      if (!job) throw new Error(`Job ${jobId} (${jobLabel}) not found`);

      if (job.status === 'SUCCEEDED') {
        this.logger.log(`[CE_DAG] ${jobLabel} job ${jobId} SUCCEEDED`);
        return;
      }
      if (job.status === 'FAILED') {
        throw new Error(`${jobLabel} job ${jobId} FAILED: ${job.lastError || 'unknown'}`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`${jobLabel} job ${jobId} timeout after ${timeoutMs}ms`);
  }

  /**
   * Wait for multiple jobs (e.g. parallel rendering)
   */
  private async waitForJobsCompletion(
    jobIds: string[],
    jobLabel: string,
    timeoutMs = 120000
  ): Promise<void> {
    const startTime = Date.now();
    const pollIntervalMs = 2000;

    while (Date.now() - startTime < timeoutMs) {
      const jobs = await this.prisma.shotJob.findMany({
        where: { id: { in: jobIds } },
      });

      const allSucceeded =
        jobs.length === jobIds.length && jobs.every((j) => j.status === 'SUCCEEDED');
      const anyFailed = jobs.find((j) => j.status === 'FAILED');

      if (allSucceeded) {
        this.logger.log(`[CE_DAG] All ${jobIds.length} ${jobLabel} jobs SUCCEEDED`);
        return;
      }
      if (anyFailed) {
        throw new Error(
          `${jobLabel} job ${anyFailed.id} FAILED: ${anyFailed.lastError || 'unknown'}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`${jobLabel} parallel loop timeout after ${timeoutMs}ms`);
  }
}
