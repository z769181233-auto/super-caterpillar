"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CEDagOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEDagOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
const database_1 = require("database");
const config_1 = require("@scu/config");
const common_2 = require("@nestjs/common");
let CEDagOrchestratorService = CEDagOrchestratorService_1 = class CEDagOrchestratorService {
    prisma;
    jobService;
    logger = new common_1.Logger(CEDagOrchestratorService_1.name);
    constructor(prisma, jobService) {
        this.prisma = prisma;
        this.jobService = jobService;
    }
    async runCEDag(req) {
        const startedAtIso = new Date().toISOString();
        const runId = req.runId || (0, crypto_1.randomUUID)();
        const traceId = req.traceId || `trace_${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16)}`;
        if (config_1.PRODUCTION_MODE && !req.referenceSheetId) {
            throw new common_2.BadRequestException({
                code: 'REFERENCE_SHEET_REQUIRED',
                message: 'Production mode requires referenceSheetId for the full pipeline (SHOT_RENDER stage).',
            });
        }
        const project = await this.prisma.project.findUnique({
            where: { id: req.projectId },
            select: { organizationId: true, ownerId: true },
        });
        if (!project?.organizationId) {
            throw new Error(`Project ${req.projectId} missing organizationId`);
        }
        const userId = project.ownerId || 'system';
        const orgId = project.organizationId;
        const jobIds = { shotRenderJobIds: [] };
        const warningsCount = 0;
        this.logger.log(`[CE_DAG] Starting Full Pipeline runId=${runId}, traceId=${traceId}, project=${req.projectId}, shot=${req.shotId}`);
        try {
            const ce06Job = await this.jobService.createCECoreJob({
                projectId: req.projectId,
                organizationId: orgId,
                jobType: database_1.JobType.CE06_NOVEL_PARSING,
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
            const anchorShot = await this.prisma.shot.findUnique({
                where: { id: req.shotId },
                include: { scene: true },
            });
            if (!anchorShot)
                throw new Error(`Shot ${req.shotId} not found`);
            const sceneId = anchorShot.sceneId;
            const novelScene = await this.prisma.scene.findFirst({
                where: {
                    chapter: {
                        novelSource: { projectId: req.projectId },
                    },
                    sceneIndex: anchorShot.scene.sceneIndex,
                },
            });
            const structuredText = novelScene?.enrichedText || 'A cinematic scene based on ' + (anchorShot.title || 'novel');
            const ce03Job = await this.jobService.createCECoreJob({
                projectId: req.projectId,
                organizationId: orgId,
                jobType: database_1.JobType.CE03_VISUAL_DENSITY,
                payload: {
                    structured_text: structuredText,
                    runId,
                    engineKey: 'ce03_visual_density',
                },
                traceId,
            });
            jobIds.ce03JobId = ce03Job.id;
            await this.waitForJobCompletion(ce03Job.id, 'CE03');
            const ce03Metrics = await this.prisma.qualityMetrics.findFirst({
                where: { projectId: req.projectId, engine: 'CE03', jobId: jobIds.ce03JobId, traceId },
                orderBy: { createdAt: 'desc' },
            });
            const ce03Score = ce03Metrics?.visualDensityScore ?? 0;
            const ce04Job = await this.jobService.createCECoreJob({
                projectId: req.projectId,
                organizationId: orgId,
                jobType: database_1.JobType.CE04_VISUAL_ENRICHMENT,
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
            this.logger.log(`[CE_DAG] [DEBUG] Fetching CE04 metrics for jobId=${jobIds.ce04JobId}`);
            const ce04Metrics = await this.prisma.qualityMetrics.findFirst({
                where: { projectId: req.projectId, engine: 'CE04', jobId: jobIds.ce04JobId, traceId },
                orderBy: { createdAt: 'desc' },
            });
            const ce04Score = ce04Metrics?.enrichmentQuality ?? 0;
            this.logger.log(`[CE_DAG] [DEBUG] CE04 score: ${ce04Score}`);
            this.logger.log(`[CE_DAG] [DEBUG] Fetching scene shots for sceneId=${sceneId}`);
            const sceneShots = await this.prisma.shot.findMany({
                where: { sceneId },
                orderBy: { index: 'asc' },
            });
            this.logger.log(`[CE_DAG] Triggering SHOT_RENDER for ${sceneShots.length} shots`);
            const renderJobs = await Promise.all(sceneShots.map((s) => this.jobService.create(s.id, {
                type: database_1.JobType.SHOT_RENDER,
                payload: {
                    runId,
                    referenceSheetId: req.referenceSheetId,
                },
                traceId,
            }, userId, orgId)));
            jobIds.shotRenderJobIds = renderJobs.map((j) => j.id);
            await this.waitForJobsCompletion(jobIds.shotRenderJobIds, 'SHOT_RENDER');
            this.logger.log(`[CE_DAG] All shots rendered. Triggering PIPELINE_TIMELINE_COMPOSE for scene ${sceneId}`);
            const composeJob = await this.jobService.createCECoreJob({
                projectId: req.projectId,
                organizationId: orgId,
                jobType: database_1.JobType.PIPELINE_TIMELINE_COMPOSE,
                payload: { sceneId, runId },
                traceId,
            });
            jobIds.timelineComposeJobId = composeJob.id;
            await this.waitForJobCompletion(composeJob.id, 'TIMELINE_COMPOSE');
            const finalComposeJob = await this.prisma.shotJob.findUnique({
                where: { id: composeJob.id },
            });
            const timelineStorageKey = finalComposeJob?.result?.output?.timelineStorageKey;
            if (!timelineStorageKey)
                throw new Error('Timeline Compose failed to produce timelineStorageKey');
            this.logger.log(`[CE_DAG] Timeline composed at ${timelineStorageKey}. Triggering TIMELINE_PREVIEW`);
            const previewJob = await this.jobService.createCECoreJob({
                projectId: req.projectId,
                organizationId: orgId,
                jobType: database_1.JobType.TIMELINE_PREVIEW,
                payload: { timelineStorageKey, pipelineRunId: runId },
                traceId,
            });
            jobIds.timelinePreviewJobId = previewJob.id;
            await this.waitForJobCompletion(previewJob.id, 'TIMELINE_PREVIEW', 180000);
            const finalPreviewJob = await this.prisma.shotJob.findUnique({
                where: { id: previewJob.id },
            });
            const previewUrl = finalPreviewJob?.result?.output?.hls_playlist_url ||
                finalPreviewJob?.result?.output?.storageKey;
            const finishedAtIso = new Date().toISOString();
            this.logger.log(`[CE_DAG] FULL SUCCESS: runId=${runId}, previewUrl=${previewUrl}`);
            return {
                runId,
                traceId,
                ce06JobId: jobIds.ce06JobId,
                ce03JobId: jobIds.ce03JobId,
                ce04JobId: jobIds.ce04JobId,
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
        }
        catch (error) {
            this.logger.error(`[CE_DAG] [DEBUG] CAUGHT ERROR in runCEDag: ${error?.message || 'No message'}`, error?.stack);
            this.logger.error(`[CE_DAG] FAILED: runId=${runId}, error=${error.message}`);
            throw error;
        }
    }
    async waitForJobCompletion(jobId, jobLabel, timeoutMs) {
        if (!timeoutMs) {
            const parsed = Number(process.env.CE_DAG_JOB_TIMEOUT_MS ?? 60000);
            timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
            this.logger.log(`[CE_DAG] job wait timeout=${timeoutMs}ms (env:${process.env.CE_DAG_JOB_TIMEOUT_MS ?? 'default'})`);
        }
        const startTime = Date.now();
        const pollIntervalMs = 1000;
        while (Date.now() - startTime < timeoutMs) {
            const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
            if (!job)
                throw new Error(`Job ${jobId} (${jobLabel}) not found`);
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
    async waitForJobsCompletion(jobIds, jobLabel, timeoutMs = 120000) {
        const startTime = Date.now();
        const pollIntervalMs = 2000;
        while (Date.now() - startTime < timeoutMs) {
            const jobs = await this.prisma.shotJob.findMany({
                where: { id: { in: jobIds } },
            });
            const allSucceeded = jobs.length === jobIds.length && jobs.every((j) => j.status === 'SUCCEEDED');
            const anyFailed = jobs.find((j) => j.status === 'FAILED');
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
};
exports.CEDagOrchestratorService = CEDagOrchestratorService;
exports.CEDagOrchestratorService = CEDagOrchestratorService = CEDagOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        job_service_1.JobService])
], CEDagOrchestratorService);
//# sourceMappingURL=ce-dag-orchestrator.service.js.map