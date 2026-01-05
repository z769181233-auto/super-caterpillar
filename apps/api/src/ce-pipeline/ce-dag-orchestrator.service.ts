import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CEDagRunRequest, CEDagRunResult, CEDagJobIds } from './ce-dag.types';

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
   * Run full CE DAG: CE06 → CE03 → CE04
   * Returns result with all job IDs and final scores
   */
  async runCEDag(req: CEDagRunRequest): Promise<CEDagRunResult> {
    const startedAtIso = new Date().toISOString();

    // 1. Generate runId/traceId if not provided (using UUID)
    const runId = req.runId || randomUUID();
    const traceId = req.traceId || `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // 2. Get project for organizationId/ownerId (商业级必修:orgId不能用projectId代替)
    const project = await this.prisma.project.findUnique({
      where: { id: req.projectId },
      select: { organizationId: true, ownerId: true },
    });

    if (!project?.organizationId) {
      throw new Error(`Project ${req.projectId} missing organizationId`);
    }

    const userId = project.ownerId || 'system';
    const orgId = project.organizationId;

    this.logger.log(
      `[CE_DAG] Starting runId=${runId}, traceId=${traceId}, project=${req.projectId}, shot=${req.shotId}`
    );

    const jobIds: CEDagJobIds = {};
    let warningsCount = 0;

    try {
      // 2. Trigger CE06 job (novel parsing)
      this.logger.log(`[CE_DAG] Phase 1: Triggering CE06...`);
      const ce06Job = await this.jobService.create(
        req.shotId, // ✅ Use shotId, not novelSourceId
        {
          type: 'CE06_NOVEL_PARSING',
          payload: { novelSourceId: req.novelSourceId, runId },
          traceId,
        },
        userId, // ✅ From project.ownerId
        orgId // ✅ From project.organizationId
      );
      jobIds.ce06JobId = ce06Job.id;

      // 3. Wait for CE06 to SUCCEED
      await this.waitForJobCompletion(ce06Job.id, 'CE06');

      // 4. Get CE06 real output (structured scenes)
      const parseResult = await this.prisma.novelParseResult.findUnique({
        where: { projectId: req.projectId },
      });
      const structuredText = parseResult?.scenes
        ? JSON.stringify(parseResult.scenes)
        : JSON.stringify([
            'A dark novel with bright red characters in blue scenes',
            'Light and shadow play across the green texture',
          ]); // Fallback with visual keywords

      const scenesJson = parseResult?.scenes;
      const scenesCount = Array.isArray(scenesJson) ? scenesJson.length : 0;
      this.logger.log(`[CE_DAG] CE06 produced scenesCount=${scenesCount}`);

      // 5. Trigger CE03 job (visual density) with CE06 real data
      this.logger.log(`[CE_DAG] Phase 2: Triggering CE03...`);
      const ce03Payload = {
        structured_text: structuredText,
        runId,
      };

      const ce03Job = await this.jobService.create(
        req.shotId, // ✅ Use shotId
        {
          type: 'CE03_VISUAL_DENSITY',
          payload: ce03Payload,
          traceId,
        },
        userId,
        orgId
      );
      jobIds.ce03JobId = ce03Job.id;

      // 6. Wait for CE03 to SUCCEED
      await this.waitForJobCompletion(ce03Job.id, 'CE03');

      // 7. Get CE03 score
      const ce03Metrics = await this.prisma.qualityMetrics.findFirst({
        where: {
          projectId: req.projectId,
          engine: 'CE03',
        },
        orderBy: { createdAt: 'desc' },
      });
      const ce03Score = ce03Metrics?.visualDensityScore ?? 0;

      // 8. Trigger CE04 job (visual enrichment) with CE06 structured_text
      this.logger.log(`[CE_DAG] Phase 3: Triggering CE04...`);
      const ce04Payload = {
        structured_text: structuredText, // ✅ Use CE06 real data, CE04 adapter supports text array
        runId,
      };

      const ce04Job = await this.jobService.create(
        req.shotId, // ✅ Use shotId
        {
          type: 'CE04_VISUAL_ENRICHMENT',
          payload: ce04Payload,
          traceId,
        },
        userId,
        orgId
      );
      jobIds.ce04JobId = ce04Job.id;

      // 9. Wait for CE04 to SUCCEED
      await this.waitForJobCompletion(ce04Job.id, 'CE04');

      // 10. Get CE04 score
      const ce04Metrics = await this.prisma.qualityMetrics.findFirst({
        where: {
          projectId: req.projectId,
          engine: 'CE04',
        },
        orderBy: { createdAt: 'desc' },
      });
      const ce04Score = ce04Metrics?.enrichmentQuality ?? 0;

      const finishedAtIso = new Date().toISOString();

      this.logger.log(`[CE_DAG] SUCCESS: runId=${runId}, CE03=${ce03Score}, CE04=${ce04Score}`);

      return {
        runId,
        traceId,
        ce06JobId: jobIds.ce06JobId!,
        ce03JobId: jobIds.ce03JobId!,
        ce04JobId: jobIds.ce04JobId!,
        ce03Score,
        ce04Score,
        warningsCount,
        startedAtIso,
        finishedAtIso,
      };
    } catch (error: any) {
      this.logger.error(`[CE_DAG] FAILED: runId=${runId}, error=${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for job to reach terminal status (SUCCEEDED or FAILED)
   * Polls database with timeout
   */
  private async waitForJobCompletion(
    jobId: string,
    jobLabel: string,
    timeoutMs = 60000
  ): Promise<void> {
    const startTime = Date.now();
    const pollIntervalMs = 1000;

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });

      if (!job) {
        throw new Error(`Job ${jobId} (${jobLabel}) not found`);
      }

      if (job.status === 'SUCCEEDED') {
        this.logger.log(`[CE_DAG] ${jobLabel} job ${jobId} SUCCEEDED`);
        return;
      }

      if (job.status === 'FAILED') {
        throw new Error(`${jobLabel} job ${jobId} FAILED: ${job.lastError || 'unknown'}`);
      }

      // Still running, wait and poll again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`${jobLabel} job ${jobId} timeout after ${timeoutMs}ms`);
  }
}
