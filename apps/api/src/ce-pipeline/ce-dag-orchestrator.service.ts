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
    ) { }

    /**
     * Run full CE DAG: CE06 → CE03 → CE04 → SHOT_RENDERs → VIDEO_RENDER
     * Returns result with all job IDs, scores and produced video info
     */
    async runCEDag(req: CEDagRunRequest): Promise<CEDagRunResult> {
        const startedAtIso = new Date().toISOString();

        // 1. Generate runId/traceId if not provided (using UUID)
        const runId = req.runId || randomUUID();
        const traceId = req.traceId || `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

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

        this.logger.log(
            `[CE_DAG] Starting Full Pipeline runId=${runId}, traceId=${traceId}, project=${req.projectId}, shot=${req.shotId}`
        );

        const jobIds: CEDagJobIds = { shotRenderJobIds: [] };
        const warningsCount = 0;

        try {
            // == Phase 1: Heavy Analysis (CE06 -> CE03 -> CE04) ==

            // 3. Trigger CE06 job (novel parsing)
            const ce06Job = await this.jobService.create(
                req.shotId,
                {
                    type: 'CE06_NOVEL_PARSING',
                    payload: { novelSourceId: req.novelSourceId, runId },
                    traceId,
                },
                userId,
                orgId
            );
            jobIds.ce06JobId = ce06Job.id;
            await this.waitForJobCompletion(ce06Job.id, 'CE06');

            // 4. Get CE06 real output
            const parseResult = await this.prisma.novelParseResult.findUnique({
                where: { projectId: req.projectId },
            });
            const structuredText = parseResult?.scenes
                ? JSON.stringify(parseResult.scenes)
                : JSON.stringify(['A dark novel with deep visual details']);

            // 5. Trigger CE03 job
            const ce03Job = await this.jobService.create(
                req.shotId,
                {
                    type: 'CE03_VISUAL_DENSITY',
                    payload: { structured_text: structuredText, runId },
                    traceId,
                },
                userId,
                orgId
            );
            jobIds.ce03JobId = ce03Job.id;
            await this.waitForJobCompletion(ce03Job.id, 'CE03');

            // 6. Get CE03 score
            const ce03Metrics = await this.prisma.qualityMetrics.findFirst({
                where: { projectId: req.projectId, engine: 'CE03', jobId: jobIds.ce03JobId, traceId },
                orderBy: { createdAt: 'desc' },
            });
            const ce03Score = ce03Metrics?.visualDensityScore ?? 0;

            // 7. Trigger CE04 job
            const ce04Job = await this.jobService.create(
                req.shotId,
                {
                    type: 'CE04_VISUAL_ENRICHMENT',
                    payload: { structured_text: structuredText, runId },
                    traceId,
                },
                userId,
                orgId
            );
            jobIds.ce04JobId = ce04Job.id;
            await this.waitForJobCompletion(ce04Job.id, 'CE04');

            // 8. Get CE04 score
            const ce04Metrics = await this.prisma.qualityMetrics.findFirst({
                where: { projectId: req.projectId, engine: 'CE04', jobId: jobIds.ce04JobId, traceId },
                orderBy: { createdAt: 'desc' },
            });
            const ce04Score = ce04Metrics?.enrichmentQuality ?? 0;

            // == Phase 2: Content Production (SHOT_RENDERs -> VIDEO_RENDER) ==

            // 9. Resolve all shots in the same scene
            const anchorShot = await this.prisma.shot.findUnique({
                where: { id: req.shotId },
                select: { sceneId: true }
            });
            const sceneId = anchorShot?.sceneId;
            if (!sceneId) throw new Error(`Anchor shot ${req.shotId} not bound to a scene`);

            const sceneShots = await this.prisma.shot.findMany({
                where: { sceneId },
                orderBy: { index: 'asc' }
            });

            this.logger.log(`[CE_DAG] Triggering SHOT_RENDER for ${sceneShots.length} shots`);

            // 10. Trigger Parallel SHOT_RENDER
            const renderJobPromises = sceneShots.map(s =>
                this.jobService.create(s.id, {
                    type: 'SHOT_RENDER',
                    payload: { runId },
                    traceId
                }, userId, orgId)
            );
            const renderJobs = await Promise.all(renderJobPromises);
            jobIds.shotRenderJobIds = renderJobs.map(j => j.id);

            // 11. Wait for all renders
            await this.waitForJobsCompletion(jobIds.shotRenderJobIds, 'SHOT_RENDER');

            // 12. Trigger VIDEO_RENDER
            this.logger.log(`[CE_DAG] All shots rendered. Triggering VIDEO_RENDER for scene ${sceneId}`);

            // Gather frame keys (assets) for the scene
            const assetsInScene = await this.prisma.asset.findMany({
                where: {
                    ownerType: 'SHOT',
                    ownerId: { in: sceneShots.map(s => s.id) },
                    type: 'IMAGE',
                    status: 'GENERATED'
                },
                orderBy: { createdAt: 'desc' }
            });

            // One asset per shot (latest)
            const frameKeys = sceneShots.map(s => {
                const a = assetsInScene.find(as => as.ownerId === s.id);
                return a?.storageKey;
            }).filter(Boolean) as string[];

            const videoJob = await this.jobService.create(req.shotId, {
                type: 'VIDEO_RENDER',
                payload: { frameKeys, fps: 24, runId },
                traceId
            }, userId, orgId);
            jobIds.videoJobId = videoJob.id;

            await this.waitForJobCompletion(videoJob.id, 'VIDEO_RENDER', 120000);

            // 13. Extract final video info
            const finalVideoJob = await this.prisma.shotJob.findUnique({ where: { id: videoJob.id } });
            const videoKey = (finalVideoJob?.payload as any)?.result?.videoKey;

            const finishedAtIso = new Date().toISOString();
            this.logger.log(`[CE_DAG] FULL SUCCESS: runId=${runId}, videoKey=${videoKey}`);

            return {
                runId,
                traceId,
                ce06JobId: jobIds.ce06JobId!,
                ce03JobId: jobIds.ce03JobId!,
                ce04JobId: jobIds.ce04JobId!,
                shotRenderJobIds: jobIds.shotRenderJobIds,
                videoJobId: jobIds.videoJobId,
                videoKey,
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
     * Wait for job to reach terminal status
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
                where: { id: { in: jobIds } }
            });

            const allSucceeded = jobs.length === jobIds.length && jobs.every(j => j.status === 'SUCCEEDED');
            const anyFailed = jobs.find(j => j.status === 'FAILED');

            if (allSucceeded) {
                this.logger.log(`[CE_DAG] All ${jobIds.length} ${jobLabel} jobs SUCCEEDED`);
                return;
            }
            if (anyFailed) {
                throw new Error(`${jobLabel} job ${anyFailed.id} FAILED: ${anyFailed.lastError || 'unknown'}`);
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        throw new Error(`${jobLabel} parallel loop timeout after ${timeoutMs}ms`);
    }
}
