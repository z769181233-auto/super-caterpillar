"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorService = void 0;
const fs = __importStar(require("fs"));
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const event_emitter_1 = require("@nestjs/event-emitter");
const published_video_service_1 = require("../publish/published-video.service");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const task_service_1 = require("../task/task.service");
const job_service_1 = require("../job/job.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const config_1 = require("@scu/config");
const database_1 = require("database");
const job_rules_1 = require("../job/job.rules");
let OrchestratorService = OrchestratorService_1 = class OrchestratorService {
    prisma;
    auditLogService;
    taskService;
    jobService;
    engineRegistry;
    publishedVideoService;
    logger = new common_1.Logger(OrchestratorService_1.name);
    constructor(prisma, auditLogService, taskService, jobService, engineRegistry, publishedVideoService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.taskService = taskService;
        this.jobService = jobService;
        this.engineRegistry = engineRegistry;
        this.publishedVideoService = publishedVideoService;
    }
    async dispatch() {
        return this.scheduleRecovery();
    }
    async scheduleRecovery() {
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const offlineCount = await this.markOfflineWorkersInternal();
        if (offlineCount > 0) {
            this.logger.log(`Marked ${offlineCount} workers as offline (dead)`);
        }
        const recoveredCount = await this.recoverJobsFromOfflineWorkers();
        if (recoveredCount > 0) {
            this.logger.log(`Recovered ${recoveredCount} jobs from offline workers`);
        }
        const retryReadyCount = await this.processRetryJobs();
        if (retryReadyCount > 0) {
            this.logger.log(`Moved ${retryReadyCount} retry jobs back to PENDING queue`);
        }
        const pendingJobsCount = await this.prisma.shotJob.count({
            where: {
                status: database_1.JobStatus.PENDING,
            },
        });
        this.logger.debug(JSON.stringify({
            event: 'DISPATCH_CYCLE',
            pendingJobs: pendingJobsCount,
            recoveredJobs: recoveredCount,
            retryReadyJobs: retryReadyCount,
            offlineWorkers: offlineCount,
            timestamp: new Date().toISOString(),
        }));
        return {
            pending: pendingJobsCount,
            dispatched: 0,
            recovered: recoveredCount,
            retryReady: retryReadyCount,
            message: 'Job dispatch is now handled by worker pull model.',
        };
    }
    async recoverJobsFromOfflineWorkers() {
        const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
        const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TTL_SECONDS * 3 * 1000);
        const deadHeartbeats = await this.prisma.workerHeartbeat.findMany({
            where: {
                status: 'DEAD',
                lastSeenAt: {
                    lt: timeoutThreshold,
                },
            },
        });
        if (deadHeartbeats.length === 0) {
            return 0;
        }
        const deadWorkerIds = deadHeartbeats.map((h) => h.workerId);
        const offlineWorkers = await this.prisma.workerNode.findMany({
            where: {
                workerId: {
                    in: deadWorkerIds,
                },
            },
        });
        if (offlineWorkers.length === 0) {
            return 0;
        }
        const offlineWorkerIds = offlineWorkers.map((w) => w.id);
        const stuckJobs = await this.prisma.shotJob.findMany({
            where: {
                status: {
                    in: [database_1.JobStatus.DISPATCHED, database_1.JobStatus.RUNNING],
                },
                workerId: {
                    in: offlineWorkerIds,
                },
            },
            include: {
                worker: true,
            },
        });
        if (stuckJobs.length === 0) {
            return 0;
        }
        this.logger.warn(JSON.stringify({
            event: 'FAULT_RECOVERY_STARTED',
            offlineWorkerCount: offlineWorkers.length,
            stuckJobCount: stuckJobs.length,
            timestamp: new Date().toISOString(),
        }));
        let recoveredCount = 0;
        const recoveredJobIds = [];
        for (const job of stuckJobs) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    if (job.status === database_1.JobStatus.DISPATCHED) {
                        (0, job_rules_1.transitionJobStatusAdmin)(job.status, database_1.JobStatus.PENDING, {
                            jobId: job.id,
                            jobType: job.type,
                            workerId: job.workerId || undefined,
                        });
                        await tx.shotJob.update({
                            where: { id: job.id },
                            data: {
                                status: database_1.JobStatus.PENDING,
                                workerId: null,
                            },
                        });
                    }
                    else if (job.status === database_1.JobStatus.RUNNING) {
                        await this.jobService.markJobFailedAndMaybeRetry(job.id, `Worker ${job.worker?.workerId || job.workerId} went dead while processing this job`);
                    }
                    recoveredJobIds.push(job.id);
                });
                recoveredCount++;
                this.logger.log(JSON.stringify({
                    event: 'JOB_RECOVERED_FROM_OFFLINE_WORKER',
                    jobId: job.id,
                    workerId: job.worker?.workerId || job.workerId || null,
                    jobType: job.type,
                    taskId: job.taskId || null,
                    statusBefore: job.status,
                    statusAfter: job.status === database_1.JobStatus.DISPATCHED ? 'PENDING' : 'PENDING/FAILED',
                    reason: 'worker_offline',
                    timestamp: new Date().toISOString(),
                }));
            }
            catch (error) {
                this.logger.error(`[Orchestrator] Failed to recover job ${job.id}: ${error.message}`);
            }
        }
        if (recoveredCount > 0 && deadHeartbeats.length > 0) {
            const workerId = deadWorkerIds[0] || 'unknown';
            const lastSeenAt = deadHeartbeats.find((h) => h.workerId === workerId)?.lastSeenAt || new Date();
            await this.auditLogService.record({
                action: 'WORKER_DEAD_RECOVERY',
                resourceType: 'worker',
                resourceId: workerId,
                details: {
                    workerId,
                    jobIds: recoveredJobIds,
                    lastSeenAt: lastSeenAt.toISOString(),
                    ttlSeconds: HEARTBEAT_TTL_SECONDS * 3,
                },
            });
        }
        return recoveredCount;
    }
    async processRetryJobs() {
        const now = new Date();
        const retryJobs = await this.prisma.shotJob.findMany({
            where: {
                status: database_1.JobStatus.RETRYING,
                workerId: null,
            },
            select: {
                id: true,
                payload: true,
                retryCount: true,
                maxRetry: true,
                type: true,
            },
        });
        if (retryJobs.length === 0) {
            return 0;
        }
        const readyToRetry = retryJobs.filter((job) => {
            const payload = job.payload || {};
            const nextRetryAt = payload.nextRetryAt ? new Date(payload.nextRetryAt) : null;
            return !nextRetryAt || nextRetryAt <= now;
        });
        if (readyToRetry.length === 0) {
            return 0;
        }
        for (const job of readyToRetry) {
            (0, job_rules_1.assertTransition)(database_1.JobStatus.RETRYING, database_1.JobStatus.PENDING, {
                jobId: job.id,
                jobType: job.type,
                errorCode: 'RETRY_JOB_RELEASED',
            });
        }
        const jobIds = readyToRetry.map((j) => j.id);
        const updated = await this.prisma.shotJob.updateMany({
            where: {
                id: { in: jobIds },
                status: database_1.JobStatus.RETRYING,
                workerId: null,
            },
            data: {
                status: database_1.JobStatus.PENDING,
                workerId: null,
            },
        });
        for (const job of readyToRetry) {
            const payload = job.payload || {};
            this.logger.debug(JSON.stringify({
                event: 'RETRY_JOB_MOVED_TO_PENDING',
                jobId: job.id,
                jobType: job.type,
                statusBefore: 'RETRYING',
                statusAfter: 'PENDING',
                retryCount: job.retryCount,
                maxRetry: job.maxRetry,
                nextRetryAt: payload.nextRetryAt || null,
                timestamp: new Date().toISOString(),
            }));
            await this.auditLogService.record({
                action: 'JOB_RETRY_RELEASED',
                resourceType: 'job',
                resourceId: job.id,
                details: {
                    statusBefore: 'RETRYING',
                    statusAfter: 'PENDING',
                    retryCount: job.retryCount,
                    maxRetry: job.maxRetry,
                    nextRetryAt: payload.nextRetryAt || null,
                },
            });
        }
        return updated.count;
    }
    async getStats() {
        const [pendingJobs, runningJobs, retryingJobs, failedJobs, succeededJobs] = await Promise.all([
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.PENDING } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.RUNNING } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.RETRYING } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.FAILED } }),
            this.prisma.shotJob.count({ where: { status: database_1.JobStatus.SUCCEEDED } }),
        ]);
        const onlineWorkers = await this.prisma.workerNode.findMany({
            where: {
                status: { in: ['online', 'idle', 'busy'] },
            },
        });
        const allWorkers = await this.prisma.workerNode.findMany({});
        const workerStats = {
            total: allWorkers.length,
            online: 0,
            offline: 0,
            idle: 0,
            busy: 0,
        };
        for (const worker of allWorkers) {
            if (worker.status === 'offline') {
                workerStats.offline++;
            }
            else if (worker.status === 'idle') {
                workerStats.idle++;
                workerStats.online++;
            }
            else if (worker.status === 'busy') {
                workerStats.busy++;
                workerStats.online++;
            }
            else if (worker.status === 'online') {
                workerStats.online++;
            }
        }
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRetryJobs = await this.prisma.shotJob.findMany({
            where: {
                status: database_1.JobStatus.RETRYING,
                updatedAt: {
                    gte: oneDayAgo,
                },
            },
            select: {
                type: true,
                retryCount: true,
            },
        });
        const retryStatsByType = {};
        for (const job of recentRetryJobs) {
            const type = job.type;
            if (!retryStatsByType[type]) {
                retryStatsByType[type] = { count: 0, totalRetryCount: 0 };
            }
            retryStatsByType[type].count++;
            retryStatsByType[type].totalRetryCount += job.retryCount;
        }
        const pendingJobsWithTime = await this.prisma.shotJob.findMany({
            where: { status: database_1.JobStatus.PENDING },
            select: {
                createdAt: true,
            },
            take: 100,
        });
        const now = new Date();
        const waitTimes = pendingJobsWithTime.map((job) => now.getTime() - job.createdAt.getTime());
        const avgWaitTimeMs = waitTimes.length > 0
            ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
            : 0;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentRecoveredJobs = await this.prisma.shotJob.count({
            where: {
                status: {
                    in: [database_1.JobStatus.RETRYING, database_1.JobStatus.PENDING],
                },
                lastError: {
                    contains: 'offline',
                },
                updatedAt: {
                    gte: oneHourAgo,
                },
            },
        });
        const allJobsForEngineStats = await this.prisma.shotJob.findMany({
            where: {
                status: {
                    in: [database_1.JobStatus.PENDING, database_1.JobStatus.RUNNING, database_1.JobStatus.FAILED],
                },
            },
            select: {
                id: true,
                status: true,
                type: true,
                payload: true,
            },
        });
        const enginesStats = {};
        for (const job of allJobsForEngineStats) {
            const engineKey = this.jobService.extractEngineKeyFromJob(job);
            if (!enginesStats[engineKey]) {
                enginesStats[engineKey] = { pending: 0, running: 0, failed: 0 };
            }
            if (job.status === database_1.JobStatus.PENDING) {
                enginesStats[engineKey].pending++;
            }
            else if (job.status === database_1.JobStatus.RUNNING) {
                enginesStats[engineKey].running++;
            }
            else if (job.status === database_1.JobStatus.FAILED) {
                enginesStats[engineKey].failed++;
            }
        }
        return {
            timestamp: new Date().toISOString(),
            jobs: {
                pending: pendingJobs,
                running: runningJobs,
                retrying: retryingJobs,
                failed: failedJobs,
                succeeded: succeededJobs,
                total: pendingJobs + runningJobs + retryingJobs + failedJobs + succeededJobs,
            },
            workers: workerStats,
            retries: {
                recent24h: {
                    total: recentRetryJobs.length,
                    byType: retryStatsByType,
                },
            },
            queue: {
                avgWaitTimeMs: Math.round(avgWaitTimeMs),
                avgWaitTimeSeconds: Math.round(avgWaitTimeMs / 1000),
            },
            recovery: {
                recent1h: {
                    recoveredJobs: recentRecoveredJobs,
                },
            },
            engines: enginesStats,
        };
    }
    async handleJobSucceededEvent(job) {
        this.logger.log(`[Orchestrator] Received job.succeeded event for job ${job.id}`);
        await this.handleJobCompletion(job.id, job.result || {});
    }
    async handleJobCompletion(jobId, result) {
        const debugLog = (msg) => fs.appendFileSync('/tmp/orchestrator_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
        debugLog(`handleJobCompletion called for ${jobId}`);
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: {
                worker: true,
            },
        });
        if (!job)
            return;
        if (job.type === database_1.JobType.SHOT_RENDER && job.status === database_1.JobStatus.SUCCEEDED) {
            this.logger.log(`[DAG] SHOT_RENDER ${jobId} completed. Checking Stage 1 pipeline progress...`);
            await this.checkAndSpawnAudioGen(job);
            await this.checkAndSpawnStage1VideoRender(job);
        }
        if (job.type === database_1.JobType.AUDIO && job.status === database_1.JobStatus.SUCCEEDED) {
            this.logger.log(`[DAG] AUDIO ${jobId} completed. Checking Stage 1 pipeline progress...`);
            await this.checkAndSpawnStage1VideoRender(job);
        }
        if (job.type === database_1.JobType.VIDEO_RENDER && job.status === database_1.JobStatus.SUCCEEDED) {
            this.logger.log(`[DAG] VIDEO_RENDER ${jobId} completed. Checking CE09 trigger...`);
            await this.checkAndSpawnCE09(job);
        }
        if (job.status === database_1.JobStatus.SUCCEEDED) {
            const payload = job.payload || {};
            const rootJobId = payload.rootJobId;
            if (rootJobId) {
                await this.handleV1PipelineChain(job, rootJobId);
            }
        }
    }
    async handleV1PipelineChain(completedChildJob, rootJobId) {
        const rootJob = await this.prisma.shotJob.findUnique({ where: { id: rootJobId } });
        if (!rootJob || rootJob.type !== database_1.JobType.PIPELINE_PROD_VIDEO_V1)
            return;
        const payload = completedChildJob.payload || {};
        const pipelineRunId = payload.pipelineRunId;
        if (completedChildJob.type === database_1.JobType.CE06_NOVEL_PARSING) {
            const chapterId = payload.chapterId || payload.payload?.chapterId;
            let scenes = [];
            if (chapterId) {
                scenes = await this.prisma.scene.findMany({ where: { chapterId } });
                this.logger.log(`[V1-ORCH] CE06 done for Chapter=${chapterId}. Found ${scenes.length} scenes.`);
            }
            else {
                this.logger.warn(`[V1-ORCH] CE06 done but no chapterId in payload ${completedChildJob.id}. Falling back to Project=${rootJob.projectId}`);
                scenes = await this.prisma.scene.findMany({ where: { projectId: rootJob.projectId } });
                this.logger.log(`[V1-ORCH] Found ${scenes.length} scenes for Project=${rootJob.projectId}.`);
            }
            for (const scene of scenes) {
                const shots = await this.prisma.shot.findMany({ where: { sceneId: scene.id } });
                this.logger.log(`[V1-ORCH] CE06 chunk parse done. Spawning ${shots.length} SHOT_RENDER for scene ${scene.id}...`);
                for (const shot of shots) {
                    await this.jobService.create(shot.id, {
                        type: database_1.JobType.SHOT_RENDER,
                        payload: {
                            projectId: rootJob.projectId,
                            sceneId: scene.id,
                            rootJobId: rootJob.id,
                            pipelineRunId,
                            engineKey: 'real_shot_render',
                            referenceSheetId: rootJob.payload?.referenceSheetId,
                        },
                        traceId: rootJob.traceId || undefined,
                    }, 'system-orch', rootJob.organizationId || 'org_dev_0000000000000000');
                }
            }
        }
        else if (completedChildJob.type === database_1.JobType.CE03_VISUAL_DENSITY) {
            this.logger.log(`[V1-ORCH] CE03 done for Root=${rootJobId}. Spawning CE04...`);
            await this.jobService.createCECoreJob({
                projectId: rootJob.projectId,
                organizationId: rootJob.organizationId,
                taskId: rootJob.taskId || undefined,
                jobType: database_1.JobType.CE04_VISUAL_ENRICHMENT,
                traceId: rootJob.traceId || undefined,
                payload: {
                    projectId: rootJob.projectId,
                    sceneId: completedChildJob.sceneId,
                    rootJobId: rootJob.id,
                    pipelineRunId,
                },
            });
        }
        else if (completedChildJob.type === database_1.JobType.CE04_VISUAL_ENRICHMENT) {
            const sceneId = payload.sceneId;
            if (!sceneId) {
                this.logger.error(`[V1-ORCH] CE04 done but no sceneId in payload ${completedChildJob.id}`);
                return;
            }
            const shots = await this.prisma.shot.findMany({ where: { sceneId } });
            this.logger.log(`[V1-ORCH] CE04 done for Root=${rootJobId}. Spawning SHOT_RENDER for ${shots.length} shots...`);
            for (const shot of shots) {
                await this.jobService.create(shot.id, {
                    type: database_1.JobType.SHOT_RENDER,
                    payload: {
                        projectId: rootJob.projectId,
                        sceneId,
                        rootJobId: rootJob.id,
                        pipelineRunId,
                        engineKey: 'real_shot_render',
                        referenceSheetId: rootJob.payload?.referenceSheetId,
                    },
                    traceId: rootJob.traceId || undefined,
                }, 'system-orch', rootJob.organizationId);
            }
        }
        else if (completedChildJob.type === database_1.JobType.CE09_MEDIA_SECURITY) {
            this.logger.log(`[V1-ORCH] CE09 done for Root=${rootJobId}. Chain Complete.`);
            await this.prisma.shotJob.update({
                where: { id: rootJobId },
                data: { status: database_1.JobStatus.SUCCEEDED },
            });
        }
    }
    async checkAndSpawnAudioGen(contextJob) {
        const audioEnabled = config_1.env.orchV2AudioEnabled;
        const payload = contextJob.payload;
        const pipelineRunId = payload?.pipelineRunId;
        this.logger.log(`[DAG] checkAndSpawnAudioGen called. audioEnabled=${audioEnabled} pipelineRunId=${pipelineRunId}`);
        if (!audioEnabled || !pipelineRunId)
            return;
        if (!pipelineRunId) {
            this.logger.warn(`[DAG] Job ${contextJob.id} matches AUDIO trigger but missing pipelineRunId. Skipping.`);
            return;
        }
        try {
            const existingAudio = await this.prisma.shotJob.findFirst({
                where: {
                    type: database_1.JobType.AUDIO,
                    payload: {
                        path: ['pipelineRunId'],
                        equals: pipelineRunId,
                    },
                },
            });
            if (existingAudio) {
                this.logger.log(`[DAG] AUDIO job already exists for pipeline ${pipelineRunId}. Skipping.`);
                return;
            }
            this.logger.log(`[DAG] Spawning AUDIO job for pipeline ${pipelineRunId} (Lazy Trigger)`);
            await this.jobService.create(contextJob.shotId, {
                type: database_1.JobType.AUDIO,
                payload: {
                    pipelineRunId,
                    text: 'AUTO_GENERATED_FROM_NOVEL_SOURCE_V1',
                    mode: 'full_mix',
                    projectId: contextJob.projectId,
                    episodeId: contextJob.episodeId,
                    sceneId: contextJob.sceneId,
                    shotId: contextJob.shotId,
                },
            }, 'gate-user', contextJob.organizationId);
        }
        catch (e) {
            this.logger.error(`[DAG] Error in checkAndSpawnAudioGen: ${e.message}`, e.stack);
        }
    }
    async checkAndSpawnStage1VideoRender(completedJob) {
        const debugLog = (msg) => fs.appendFileSync('/tmp/orchestrator_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
        const payload = completedJob.payload;
        const pipelineRunId = payload?.pipelineRunId;
        debugLog(`checkAndSpawnStage1VideoRender: Job=${completedJob.id} Pipeline=${pipelineRunId}`);
        if (!pipelineRunId) {
            this.logger.debug(`[DAG] Job ${completedJob.id} has no pipelineRunId. Skipping DAG check.`);
            return;
        }
        const allShots = await this.prisma.shotJob.findMany({
            where: {
                type: database_1.JobType.SHOT_RENDER,
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
            include: { shot: true },
        });
        const total = allShots.length;
        const succeeded = allShots.filter((j) => j.status === database_1.JobStatus.SUCCEEDED).length;
        const pending = allShots.filter((j) => j.status !== database_1.JobStatus.SUCCEEDED && j.status !== database_1.JobStatus.FAILED).length;
        this.logger.log(`[DAG] Pipeline ${pipelineRunId} progress: ${succeeded}/${total} (Pending: ${pending})`);
        let audioReady = false;
        let audioTrack = null;
        const audioEnabled = true;
        if (audioEnabled) {
            const audioJob = await this.prisma.shotJob.findFirst({
                where: {
                    type: database_1.JobType.AUDIO,
                    payload: {
                        path: ['pipelineRunId'],
                        equals: pipelineRunId,
                    },
                },
            });
            if (audioJob && audioJob.status === database_1.JobStatus.SUCCEEDED) {
                audioReady = true;
                const result = audioJob.payload;
                const output = audioJob.result?.output ||
                    audioJob.payload?.result?.output ||
                    audioJob.payload?.output;
                if (output)
                    audioTrack = output;
            }
            else if (!audioJob) {
            }
        }
        else {
            audioReady = true;
        }
        if (total > 0 && succeeded === total) {
            if (audioEnabled && !audioReady) {
                this.logger.log(`[DAG] Video Ready for ${pipelineRunId}, waiting for Audio...`);
                return;
            }
            await this.aggregateAndSpawnVideoRender(allShots, pipelineRunId, allShots[0], audioTrack);
        }
    }
    async aggregateAndSpawnVideoRender(shots, pipelineRunId, contextJob, audioTrack = null) {
        const existingVideoJob = await this.prisma.shotJob.findFirst({
            where: {
                type: database_1.JobType.VIDEO_RENDER,
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
        });
        if (existingVideoJob) {
            this.logger.log(`[DAG] VIDEO_RENDER for ${pipelineRunId} already exists (${existingVideoJob.id}). Skipping.`);
            return;
        }
        const frames = [];
        shots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        for (const job of shots) {
            const output = job.result?.output ||
                job.payload?.result?.output ||
                job.payload?.output;
            const storageKey = output?.storageKey;
            if (storageKey) {
                frames.push(storageKey);
            }
            else {
                this.logger.warn(`[DAG] Job ${job.id} SUCCEEDED but missing storageKey in result/payload. result=${JSON.stringify(job.result)}`);
            }
        }
        if (frames.length === 0) {
            this.logger.warn(`[DAG] No frames collected for ${pipelineRunId}. Skipping VIDEO_RENDER.`);
            return;
        }
        const isVerification = !!contextJob.isVerification;
        const dedupeKey = isVerification ? `gate_video:${pipelineRunId}` : undefined;
        if (isVerification) {
            this.logger.log(`[DAG] VIDEO_RENDER will inherit isVerification=true from parent job ${contextJob.id}`);
        }
        this.logger.log(`[DAG] Spawning VIDEO_RENDER for ${pipelineRunId} with ${frames.length} frames (isVerification=${isVerification}).`);
        try {
            const videoJob = await this.jobService.create(contextJob.shotId, {
                type: database_1.JobType.VIDEO_RENDER,
                traceId: contextJob.traceId,
                isVerification,
                dedupeKey,
                payload: {
                    pipelineRunId,
                    projectId: contextJob.projectId,
                    episodeId: contextJob.shot?.episodeId || contextJob.episodeId,
                    sceneId: contextJob.shot?.sceneId,
                    frames,
                    audioTrack: audioTrack || undefined,
                    publish: true,
                    traceId: contextJob.traceId,
                    isVerification,
                    rootJobId: contextJob.payload?.rootJobId,
                },
            }, 'system-dag', contextJob.organizationId);
            this.logger.log(`[DAG] VIDEO_RENDER created: jobId=${videoJob.id}, isVerification=${isVerification}`);
        }
        catch (e) {
            this.logger.error(`[DAG] Failed to spawn VIDEO_RENDER: ${e.message}`);
        }
    }
    async checkAndSpawnCE09(videoJob) {
        const payload = videoJob.payload;
        const pipelineRunId = payload?.pipelineRunId;
        if (!pipelineRunId) {
            this.logger.warn(`[DAG] VIDEO_RENDER ${videoJob.id} missing pipelineRunId. Cannot spawn CE09.`);
            return;
        }
        const existing = await this.prisma.shotJob.findFirst({
            where: {
                type: database_1.JobType.CE09_MEDIA_SECURITY,
                payload: { path: ['pipelineRunId'], equals: pipelineRunId },
            },
        });
        if (existing) {
            this.logger.log(`[DAG] CE09 for ${pipelineRunId} already exists (${existing.id}). Skipping.`);
            return;
        }
        const start = Date.now();
        const result = videoJob.result;
        const assetId = result?.assetId || result?.output?.assetId;
        const storageKey = result?.storageKey || result?.output?.storageKey;
        if (!assetId || !storageKey) {
            this.logger.error(`[DAG] VIDEO_RENDER succeeded but missing assetId/storageKey in result. Cannot spawn CE09. Result: ${JSON.stringify(result)}`);
            return;
        }
        this.logger.log(`[DAG] Spawning CE09 for ${pipelineRunId} from VIDEO_RENDER asset ${assetId}`);
        try {
            await this.jobService.create(videoJob.shotId || videoJob.id, {
                type: database_1.JobType.CE09_MEDIA_SECURITY,
                traceId: videoJob.traceId,
                payload: {
                    pipelineRunId,
                    projectId: payload.projectId,
                    episodeId: payload.episodeId,
                    shotId: videoJob.shotId,
                    assetId,
                    videoAssetStorageKey: storageKey,
                    traceId: videoJob.traceId,
                    engineKey: 'ce09_security_real',
                    rootJobId: payload?.rootJobId,
                },
            }, 'system-dag', videoJob.organizationId);
            this.logger.log(`[DAG] CE09 spawned successfully for ${pipelineRunId}`);
        }
        catch (e) {
            this.logger.error(`[DAG] Failed to spawn CE09: ${e.message}`);
        }
    }
    async createCECoreDAG(projectId, organizationId, novelSourceId) {
        this.logger.log(`Creating CE Core DAG for project ${projectId}, novelSourceId ${novelSourceId}`);
        const { randomUUID } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const traceId = `ce_pipeline_${randomUUID()}`;
        const task = await this.taskService.create({
            organizationId,
            projectId,
            type: database_1.TaskType.CE_CORE_PIPELINE,
            status: database_1.TaskStatus.PENDING,
            payload: {
                novelSourceId,
                pipeline: ['CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
            },
            traceId,
        });
        const ce06Job = await this.jobService.createCECoreJob({
            projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE06_NOVEL_PARSING,
            payload: {
                projectId,
                novelSourceId,
                engineKey: 'ce06_novel_parsing',
            },
        });
        this.logger.log(`CE Core DAG created: taskId=${task.id}, ce06JobId=${ce06Job.id}`);
        return {
            taskId: task.id,
            jobIds: [ce06Job.id],
        };
    }
    async startStage1Pipeline(params) {
        try {
            const { novelText, projectId: existingProjectId, referenceSheetId: existingRefId } = params;
            const { randomUUID } = await Promise.resolve().then(() => __importStar(require('crypto')));
            const traceId = `stage1_${randomUUID()}`;
            console.log('[DEBUG_A1] Service Step 1: Resolving Project...');
            let projectId = existingProjectId;
            const defaultOrg = await this.prisma.organization.findFirst();
            let organizationId = defaultOrg?.id || 'default-org';
            const defaultUser = await this.prisma.user.findFirst();
            const ownerId = defaultUser?.id || 'system';
            if (!projectId) {
                const project = await this.prisma.project.create({
                    data: {
                        name: `Stage1_${new Date().toISOString().slice(0, 10)}`,
                        organizationId,
                        status: 'in_progress',
                        ownerId,
                    },
                });
                projectId = project.id;
            }
            else {
                const project = await this.prisma.project.findUnique({ where: { id: projectId } });
                if (!project)
                    throw new Error(`Project ${projectId} not found`);
                organizationId = project.organizationId;
            }
            console.log(`[DEBUG_A1] Project resolved: ${projectId}`);
            console.log('[DEBUG_A1] Service Step 2: Creating Novel, Volume, Chapter...');
            const novelSource = await this.prisma.novel.create({
                data: {
                    title: `Stage1_${new Date().toISOString().slice(0, 10)}`,
                    projectId,
                    author: 'System',
                },
            });
            const volume = await this.prisma.novelVolume.create({
                data: {
                    projectId,
                    novelSourceId: novelSource.id,
                    index: 1,
                    title: 'Volume 1',
                },
            });
            const chapter = await this.prisma.novelChapter.create({
                data: {
                    novelSourceId: novelSource.id,
                    volumeId: volume.id,
                    index: 1,
                    title: 'Chapter 1',
                },
            });
            await this.prisma.scene.create({
                data: {
                    chapterId: chapter.id,
                    sceneIndex: 1,
                    enrichedText: novelText,
                },
            });
            console.log('[DEBUG_A1] Novel structure created');
            const episode = await this.prisma.episode.create({
                data: {
                    projectId,
                    seasonId: null,
                    index: 1,
                    name: 'Chapter 1',
                    chapterId: chapter.id,
                },
            });
            const scene = await this.prisma.scene.create({
                data: {
                    episodeId: episode.id,
                    projectId,
                    sceneIndex: 9999,
                    title: 'Stage 1 Pipeline Scene',
                    summary: 'Auto-generated for pipeline orchestration',
                },
            });
            const shot = await this.prisma.shot.create({
                data: {
                    sceneId: scene.id,
                    index: 9999,
                    title: 'Stage 1 Pipeline Shot',
                    description: 'Auto-generated for pipeline orchestration',
                    type: 'pipeline_stage1',
                    params: {},
                    organizationId,
                },
            });
            console.log(`[DEBUG_A1] Episode/Shot created: shotId=${shot.id}`);
            console.log('[DEBUG_A1] Service Step 4: Dispatching Job via jobService.create...');
            const job = await this.jobService.create(shot.id, {
                type: database_1.JobType.SHOT_RENDER,
                traceId,
                isVerification: true,
                payload: {
                    novelText,
                    novelSourceId: novelSource.id,
                    chapterId: chapter.id,
                    episodeId: episode.id,
                    pipelineRunId: traceId,
                    projectId,
                    organizationId,
                    referenceSheetId: existingRefId || 'gate-mock-ref-id',
                },
            }, ownerId, organizationId);
            console.log(`[DEBUG_A1] Job created: ${job.id}`);
            this.logger.log(`Stage 1 Pipeline Started: jobId=${job.id}, projectId=${projectId}, traceId=${traceId}`);
            return {
                success: true,
                pipelineRunId: traceId,
                jobId: job.id,
                projectId,
                episodeId: episode.id,
            };
        }
        catch (e) {
            this.logger.error({
                tag: 'ORCHESTRATOR_PIPELINE_ERROR',
                error: e.message,
                stack: e.stack,
                params: { novelTextLen: params.novelText?.length, projectId: params.projectId },
            });
            throw e;
        }
    }
    async markOfflineWorkersInternal() {
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const { workerOfflineGraceMs } = scuEnv;
        const timeoutThreshold = new Date(Date.now() - workerOfflineGraceMs);
        this.logger.log(`[Recovery] Checking for dead workers... threshold: ${timeoutThreshold.toISOString()}, grace: ${workerOfflineGraceMs}ms`);
        const timedOutHeartbeats = await this.prisma.workerHeartbeat.findMany({
            where: {
                lastSeenAt: {
                    lt: timeoutThreshold,
                },
                status: {
                    not: 'DEAD',
                },
            },
        });
        if (timedOutHeartbeats.length > 0) {
            const idsToMark = timedOutHeartbeats.map((h) => h.workerId);
            this.logger.warn(`[Recovery] Marking ${idsToMark.length} workers as DEAD: ${idsToMark.join(', ')}`);
            await this.prisma.workerHeartbeat.updateMany({
                where: { workerId: { in: idsToMark } },
                data: { status: 'DEAD' },
            });
            await this.prisma.workerNode.updateMany({
                where: { workerId: { in: idsToMark } },
                data: { status: 'offline' },
            });
        }
        const reclaimedCount = await this.reclaimJobsFromDeadWorkersInternal();
        if (reclaimedCount > 0) {
            this.logger.warn(`[OrchestratorService] Reclaimed ${reclaimedCount} jobs from dead workers (internal).`);
        }
        return reclaimedCount;
    }
    async reclaimJobsFromDeadWorkersInternal() {
        const deadWorkerIds = await this.getDeadWorkerIdsInternal();
        if (deadWorkerIds.length === 0)
            return 0;
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const orphaned = await tx.shotJob.findMany({
                where: {
                    status: 'RUNNING',
                    lockedBy: { in: deadWorkerIds },
                    leaseUntil: { lte: now },
                },
                select: { id: true, projectId: true, lockedBy: true },
            });
            if (orphaned.length === 0)
                return 0;
            await tx.shotJob.updateMany({
                where: { id: { in: orphaned.map((j) => j.id) } },
                data: {
                    status: database_1.JobStatus.PENDING,
                    workerId: null,
                    lockedBy: null,
                    leaseUntil: null,
                    lastError: 'reclaimed: dead worker (internal)',
                },
            });
            for (const j of orphaned) {
                if (j.projectId) {
                    const project = await tx.project.findUnique({
                        where: { id: j.projectId },
                        select: { organizationId: true },
                    });
                    if (project) {
                        await tx.auditLog.create({
                            data: {
                                action: 'JOB_RECLAIMED_FROM_DEAD_WORKER',
                                resourceType: 'shot_job',
                                resourceId: j.id,
                                orgId: project.organizationId,
                                details: { deadWorkerId: j.lockedBy, projectId: j.projectId },
                                createdAt: new Date(),
                            },
                        });
                    }
                }
            }
            this.logger.warn(`Reclaimed ${orphaned.length} jobs from ${deadWorkerIds.length} dead workers`);
            return orphaned.length;
        });
    }
    async getDeadWorkerIdsInternal() {
        const rows = await this.prisma.workerHeartbeat.findMany({
            where: { status: 'DEAD' },
            select: { workerId: true },
        });
        return rows.map((r) => r.workerId);
    }
};
exports.OrchestratorService = OrchestratorService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrchestratorService.prototype, "scheduleRecovery", null);
__decorate([
    (0, event_emitter_1.OnEvent)('job.succeeded'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrchestratorService.prototype, "handleJobSucceededEvent", null);
exports.OrchestratorService = OrchestratorService = OrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        task_service_1.TaskService,
        job_service_1.JobService,
        engine_registry_service_1.EngineRegistry,
        published_video_service_1.PublishedVideoService])
], OrchestratorService);
//# sourceMappingURL=orchestrator.service.js.map