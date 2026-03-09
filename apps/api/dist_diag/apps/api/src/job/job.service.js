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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JobService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobService = exports.TaskTypeEnum = exports.TaskStatusEnum = exports.JobTypeEnum = exports.JobStatusEnum = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const observability_1 = require("@scu/observability");
const capacity_errors_1 = require("../common/errors/capacity-errors");
const prisma_service_1 = require("../prisma/prisma.service");
const task_service_1 = require("../task/task.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const audit_constants_1 = require("../audit/audit.constants");
const project_resolver_1 = require("../common/project-resolver");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const quality_score_service_1 = require("../quality/quality-score.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const job_engine_binding_service_1 = require("./job-engine-binding.service");
const billing_service_1 = require("../billing/billing.service");
const financial_settlement_service_1 = require("../billing/financial-settlement.service");
const copyright_service_1 = require("../copyright/copyright.service");
const capacity_gate_service_1 = require("../capacity/capacity-gate.service");
const budget_service_1 = require("../billing/budget.service");
const feature_flag_service_1 = require("../feature-flag/feature-flag.service");
const text_safety_service_1 = require("../text-safety/text-safety.service");
const published_video_service_1 = require("../publish/published-video.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const database_1 = require("database");
const job_rules_1 = require("./job.rules");
exports.JobStatusEnum = database_1.JobStatus;
exports.JobTypeEnum = database_1.JobType;
exports.TaskStatusEnum = database_1.TaskStatus;
exports.TaskTypeEnum = database_1.TaskType;
const job_auth_ops_service_1 = require("./job-auth-ops.service");
const job_creation_ops_service_1 = require("./job-creation-ops.service");
const job_update_ops_service_1 = require("./job-update-ops.service");
let JobService = JobService_1 = class JobService {
    prisma;
    taskService;
    auditLogService;
    engineRegistry;
    qualityScoreService;
    engineConfigStore;
    jobEngineBindingService;
    billingService;
    copyrightService;
    capacityGateService;
    featureFlagService;
    textSafetyService;
    budgetService;
    publishedVideoService;
    eventEmitter;
    financialSettlementService;
    projectResolver;
    jobAuthOps;
    jobCreationOps;
    jobUpdateOps;
    logger = new common_1.Logger(JobService_1.name);
    constructor(prisma, taskService, auditLogService, engineRegistry, qualityScoreService, engineConfigStore, jobEngineBindingService, billingService, copyrightService, capacityGateService, featureFlagService, textSafetyService, budgetService, publishedVideoService, eventEmitter, financialSettlementService, projectResolver, jobAuthOps, jobCreationOps, jobUpdateOps) {
        this.prisma = prisma;
        this.taskService = taskService;
        this.auditLogService = auditLogService;
        this.engineRegistry = engineRegistry;
        this.qualityScoreService = qualityScoreService;
        this.engineConfigStore = engineConfigStore;
        this.jobEngineBindingService = jobEngineBindingService;
        this.billingService = billingService;
        this.copyrightService = copyrightService;
        this.capacityGateService = capacityGateService;
        this.featureFlagService = featureFlagService;
        this.textSafetyService = textSafetyService;
        this.budgetService = budgetService;
        this.publishedVideoService = publishedVideoService;
        this.eventEmitter = eventEmitter;
        this.financialSettlementService = financialSettlementService;
        this.projectResolver = projectResolver;
        this.jobAuthOps = jobAuthOps;
        this.jobCreationOps = jobCreationOps;
        this.jobUpdateOps = jobUpdateOps;
    }
    async checkShotOwnership(shotId, userId, organizationId) {
        return this.jobAuthOps.checkShotOwnership(shotId, organizationId);
    }
    async create(shotId, createJobDto, userId, organizationId, taskId) {
        return this.jobCreationOps.create(shotId, createJobDto, userId, organizationId, taskId);
    }
    async ackJob(jobId, workerId) {
        return this.jobUpdateOps.ackJob(jobId, workerId);
    }
    async reportJobResult(jobId, status, result, errorMessage, userId, apiKeyId, ip, userAgent, hmacMeta, attempts) {
        return this.jobUpdateOps.reportJobResult(jobId, { status: status, result, errorMessage }, userId);
    }
    async markJobFailedAndMaybeRetry(jobId, errorMessage, userId) {
        return this.jobUpdateOps.markJobFailedAndMaybeRetry(jobId, errorMessage, userId);
    }
    async completeJob(jobId, workerId, params) {
        return this.jobUpdateOps.completeJob(jobId, workerId, params);
    }
    async validateReferenceSheetId(referenceSheetId, organizationId, projectId, isVerification = false) {
        return this.jobCreationOps.validateReferenceSheetId(referenceSheetId, organizationId, projectId, isVerification);
    }
    async createNovelAnalysisJob(createJobDto, userId, organizationId, taskId, apiKeyId, ip, userAgent) {
        const payload = (createJobDto.payload || {});
        const traceId = createJobDto.traceId || (0, observability_1.getTraceId)() || createJobDto.payload?.traceId || (0, crypto_1.randomUUID)();
        let shotId = payload.shotId;
        let episodeId = payload.episodeId;
        let sceneId = payload.sceneId;
        const projectId = payload.projectId;
        const chapterId = payload.chapterId;
        if (!projectId) {
            throw new common_1.BadRequestException('projectId is required for novel analysis job');
        }
        if (!shotId) {
            let episode = null;
            if (chapterId) {
                episode = await this.prisma.episode.findUnique({
                    where: { chapterId },
                });
            }
            if (!episode) {
                const episodeIndex = (await this.prisma.episode.count({ where: { projectId } })) + 1;
                episode = await this.prisma.episode.create({
                    data: {
                        projectId,
                        seasonId: null,
                        chapterId: chapterId,
                        index: episodeIndex,
                        name: `Episode ${episodeIndex}`,
                        summary: 'Auto generated for novel analysis',
                    },
                });
            }
            episodeId = episode.id;
            const scene = await this.prisma.scene.create({
                data: {
                    episodeId: episode.id,
                    projectId,
                    sceneIndex: 9999,
                    title: `Job Placeholder Scene`,
                    summary: 'Auto generated for novel analysis',
                },
            });
            sceneId = scene.id;
            const shot = await this.prisma.shot.create({
                data: {
                    sceneId: scene.id,
                    index: 9999,
                    title: `Job Placeholder Shot`,
                    description: 'Auto generated for novel analysis',
                    type: 'novel_analysis',
                    params: {},
                    organizationId,
                },
            });
            shotId = shot.id;
        }
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: {
                scene: {
                    include: {
                        episode: {
                            include: {
                                project: true,
                                season: { include: { project: true } },
                            },
                        },
                    },
                },
            },
        });
        const scene = shot?.scene;
        const episode = scene?.episode;
        const project = await this.projectResolver.resolveProjectAuthOnly(episode);
        if (!scene || !episode || !project) {
            throw new common_1.NotFoundException('Shot hierarchy is incomplete');
        }
        const job = await this.prisma.$transaction(async (tx) => {
            const createdJob = await tx.shotJob.create({
                data: {
                    organizationId,
                    projectId: project.id,
                    episodeId: episode.id ?? episodeId,
                    sceneId: scene.id ?? sceneId,
                    shotId,
                    taskId,
                    type: exports.JobTypeEnum.NOVEL_ANALYSIS,
                    status: exports.JobStatusEnum.PENDING,
                    priority: 0,
                    maxRetry: 3,
                    retryCount: 0,
                    attempts: 0,
                    payload: createJobDto.payload ?? {},
                    engineConfig: createJobDto.engineConfig ?? {},
                    isVerification: createJobDto.isVerification || false,
                    traceId,
                    dedupeKey: createJobDto.dedupeKey,
                },
            });
            const engineSelection = await this.jobEngineBindingService.selectEngineForJob(exports.JobTypeEnum.NOVEL_ANALYSIS);
            if (!engineSelection) {
                throw new common_1.BadRequestException(`No engine available for job type: ${exports.JobTypeEnum.NOVEL_ANALYSIS}`);
            }
            await tx.jobEngineBinding.create({
                data: {
                    jobId: createdJob.id,
                    engineId: engineSelection.engineId,
                    engineKey: engineSelection.engineKey,
                    engineVersionId: engineSelection.engineVersionId,
                    status: database_1.JobEngineBindingStatus.BOUND,
                    metadata: {
                        strategy: 'default',
                        jobType: exports.JobTypeEnum.NOVEL_ANALYSIS,
                    },
                },
            });
            return createdJob;
        });
        await this.auditLogService.record({
            userId,
            apiKeyId,
            action: audit_constants_1.AuditActions.JOB_CREATED,
            resourceType: 'job',
            resourceId: job.id,
            ip,
            userAgent,
            details: { type: job.type, taskId: job.taskId },
        });
        return job;
    }
    async createCECoreJob(params) {
        const { projectId, organizationId, taskId, jobType, payload, isVerification, dedupeKey, priority, } = params;
        let traceId = params.traceId;
        if (dedupeKey) {
            const existing = await this.prisma.shotJob.findUnique({
                where: { dedupeKey },
            });
            if (existing) {
                return existing;
            }
        }
        const budgetStatus = await this.budgetService.getBudgetStatus(organizationId, projectId);
        if (budgetStatus.level === 'BLOCK_ALL_CONSUME') {
            throw new common_1.BadRequestException(`Budget Exceeded: Organization ${organizationId} is blocked due to excessive cost.`);
        }
        const capacity = await this.capacityGateService.checkJobCapacity(jobType, organizationId);
        if (!capacity.allowed) {
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                message: capacity.reason || 'Capacity Exceeded',
                errorCode: capacity.errorCode,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (payload && typeof payload === 'object') {
            payload._metadata = {
                ...payload._metadata,
                pipeline_timeout_ms: 1800000,
                created_at: new Date().toISOString(),
            };
        }
        try {
            if (!traceId && taskId) {
                const task = await this.prisma.task.findUnique({
                    where: { id: taskId },
                    select: { traceId: true },
                });
                if (task)
                    traceId = task.traceId ?? undefined;
            }
            if (!traceId)
                traceId = `tr_ce01_${(0, crypto_1.randomUUID)()}`;
            let episode = await this.prisma.episode.findFirst({
                where: { projectId },
                orderBy: { index: 'asc' },
            });
            if (!episode) {
                episode = await this.prisma.episode.create({
                    data: {
                        projectId,
                        seasonId: null,
                        index: 1,
                        name: 'Episode 1',
                        summary: 'Auto generated for CE Core Layer',
                    },
                });
            }
            let scene = await this.prisma.scene.findFirst({
                where: { episodeId: episode.id },
                orderBy: { sceneIndex: 'asc' },
            });
            if (!scene) {
                scene = await this.prisma.scene.create({
                    data: {
                        episodeId: episode.id,
                        projectId,
                        sceneIndex: payload.sceneIndex || 1,
                        title: payload.sceneTitle || 'Auto Scene',
                        summary: payload.sceneDescription || 'Auto generated for CE Core Layer',
                    },
                });
            }
            let shot = await this.prisma.shot.findFirst({
                where: { sceneId: scene.id },
                orderBy: { index: 'asc' },
            });
            if (!shot) {
                shot = await this.prisma.shot.create({
                    data: {
                        sceneId: scene.id,
                        index: 1,
                        title: 'Shot 1',
                        description: 'Auto generated for CE Core Layer',
                        type: 'ce_core',
                        params: {},
                        organizationId,
                    },
                });
            }
            const actualSceneId = payload.sceneId || scene.id;
            const job = await this.prisma.shotJob.create({
                data: {
                    organizationId,
                    projectId,
                    episodeId: episode.id,
                    sceneId: actualSceneId,
                    shotId: shot.id,
                    taskId,
                    type: jobType,
                    status: exports.JobStatusEnum.PENDING,
                    priority: priority ?? 0,
                    maxRetry: 3,
                    retryCount: 0,
                    attempts: 0,
                    payload: payload ?? {},
                    engineConfig: payload.engineConfig ?? {},
                    traceId,
                    isVerification: isVerification || false,
                    dedupeKey: dedupeKey,
                },
            });
            await this.auditLogService.record({
                action: audit_constants_1.AuditActions.JOB_CREATED,
                resourceType: 'job',
                resourceId: job.id,
                details: { type: job.type, taskId: job.taskId, jobType },
            });
            return job;
        }
        catch (error) {
            this.logger.error(`[JobService] createCECoreJob FAILED: ${error.message}`, error.stack);
            throw error;
        }
    }
    async createCharacterReferenceSheetJob(params) {
        const { characterId, organizationId, projectId, posePreset = 'front', styleSeed = 'default', userId, traceId, } = params;
        const engineKey = 'character_visual';
        const jobType = exports.JobTypeEnum.CE01_REFERENCE_SHEET;
        const engineConfig = await this.engineConfigStore.resolveEngineConfig(engineKey, 'default');
        const engineVersion = engineConfig?.version || 'default';
        const fingerprint = `fp_ce01_${characterId}_${posePreset}_${styleSeed}_${engineVersion}`;
        const existingBinding = await this.prisma.jobEngineBinding.findFirst({
            where: {
                engineKey,
                status: {
                    in: [
                        database_1.JobEngineBindingStatus.BOUND,
                        database_1.JobEngineBindingStatus.EXECUTING,
                        database_1.JobEngineBindingStatus.COMPLETED,
                    ],
                },
                metadata: {
                    path: ['fingerprint'],
                    equals: fingerprint,
                },
                job: {
                    organizationId,
                    projectId,
                },
            },
            include: { engineVersion: true },
        });
        if (existingBinding) {
            this.logger.log(`[CE01] Idempotency hit: found existing binding ${existingBinding.id} for fingerprint ${fingerprint}`);
            return {
                referenceSheetId: existingBinding.id,
                engineKey: existingBinding.engineKey,
                engineVersion: existingBinding.engineVersion?.versionName || 'default',
                fingerprint,
            };
        }
        const job = await this.createCECoreJob({
            projectId,
            organizationId,
            jobType,
            traceId,
            payload: {
                characterId,
                posePreset,
                styleSeed,
                fingerprint,
                traceId,
            },
        });
        const binding = await this.prisma.$transaction(async (tx) => {
            let b = await tx.jobEngineBinding.findUnique({ where: { jobId: job.id } });
            if (!b) {
                const engine = await tx.engine.findUnique({ where: { engineKey } });
                if (!engine)
                    throw new common_1.BadRequestException(`Mother engine ${engineKey} missing`);
                b = await tx.jobEngineBinding.create({
                    data: {
                        jobId: job.id,
                        engineId: engine.id,
                        engineKey,
                        status: database_1.JobEngineBindingStatus.BOUND,
                        metadata: {
                            characterId,
                            fingerprint,
                            posePreset,
                            styleSeed,
                        },
                    },
                });
            }
            else {
                b = await tx.jobEngineBinding.update({
                    where: { id: b.id },
                    data: {
                        metadata: {
                            ...(b.metadata || {}),
                            characterId,
                            fingerprint,
                            posePreset,
                            styleSeed,
                        },
                    },
                });
            }
            return b;
        });
        return {
            referenceSheetId: binding.id,
            engineKey: binding.engineKey,
            engineVersion,
            fingerprint,
        };
    }
    async ensureVideoRenderJob(shotId, frameKeys, traceId, userId, organizationId, isVerification = false) {
        const jobType = exports.JobTypeEnum.VIDEO_RENDER;
        return this.prisma.$transaction(async (tx) => {
            const capacityCheck = await this.capacityGateService.checkVideoRenderCapacity(organizationId, userId, tx);
            if (!capacityCheck.allowed) {
                throw new capacity_errors_1.CapacityExceededException(capacityCheck.errorCode, capacityCheck.currentCount || 0, capacityCheck.limit || 0, capacityCheck.reason);
            }
            const existing = await tx.shotJob.findFirst({
                where: {
                    shotId,
                    type: jobType,
                    status: { notIn: [exports.JobStatusEnum.FAILED] },
                },
            });
            if (existing) {
                if (isVerification && !existing.isVerification) {
                    throw new common_1.BadRequestException({
                        code: 'VIDEO_RENDER_VERIFICATION_MISMATCH',
                        message: 'Existing VIDEO_RENDER job is non-verification but current pipeline requires verification. Refuse to reuse to avoid billing contamination.',
                        details: {
                            shotId,
                            existingJobId: existing.id,
                            existingIsVerification: existing.isVerification,
                            requiredIsVerification: isVerification,
                            traceId,
                        },
                    });
                }
                this.logger.log(`[JobService] ensureVideoRenderJob: Job already exists (${existing.id}), isVerification=${existing.isVerification}, skipping.`);
                return existing;
            }
            const shotHierarchy = await tx.shot.findUnique({
                where: { id: shotId },
                include: { scene: { include: { episode: true } } },
            });
            if (!shotHierarchy)
                throw new common_1.NotFoundException('Resource not found');
            const projectId = shotHierarchy.scene.projectId || shotHierarchy.scene.episode?.projectId;
            if (!projectId)
                throw new common_1.BadRequestException('Project ID not found for scene');
            const task = await this.taskService.create({
                organizationId,
                projectId: projectId,
                type: exports.TaskTypeEnum.VIDEO_RENDER,
                status: exports.TaskStatusEnum.PENDING,
                payload: { shotId, jobType, isVerification },
                traceId,
            });
            const job = await tx.shotJob.create({
                data: {
                    organizationId,
                    projectId: projectId,
                    episodeId: shotHierarchy.scene.episodeId,
                    sceneId: shotHierarchy.scene.id,
                    shotId,
                    taskId: task.id,
                    type: jobType,
                    status: exports.JobStatusEnum.PENDING,
                    isVerification: isVerification ?? false,
                    payload: {
                        shotId,
                        frameKeys,
                        pipelineRunId: traceId,
                        fps: 24,
                        isVerification,
                    },
                    traceId,
                },
            });
            const engineSelection = await this.jobEngineBindingService.selectEngineForJob(jobType);
            if (!engineSelection) {
                throw new common_1.BadRequestException(`No engine available for job type: ${jobType}`);
            }
            await tx.jobEngineBinding.create({
                data: {
                    jobId: job.id,
                    engineId: engineSelection.engineId,
                    engineKey: engineSelection.engineKey,
                    engineVersionId: engineSelection.engineVersionId,
                    status: database_1.JobEngineBindingStatus.BOUND,
                    metadata: {
                        strategy: 'default',
                        jobType: jobType,
                        reason: 'ensureVideoRenderJob',
                        isVerification,
                    },
                },
            });
            this.logger.log(`[JobService] ensureVideoRenderJob: Created job ${job.id}, isVerification=${isVerification}, traceId=${traceId}, bound to ${engineSelection.engineKey}`);
            return job;
        });
    }
    async getAndMarkNextPendingJob(workerId, jobType) {
        if (!workerId?.trim()) {
            throw new Error('workerId cannot be empty for claim audit');
        }
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        const jobMaxInFlight = scuEnv.jobMaxInFlight || 10;
        const jobLeaseTtlMs = scuEnv.jobLeaseTtlMs || 30000;
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(8472834)`;
            const worker = await tx.workerNode.findUnique({
                where: { workerId },
            });
            if (!worker) {
                return null;
            }
            const caps = worker.capabilities;
            if (caps?.disabled === true) {
                return null;
            }
            const runningCountResult = await tx.$queryRaw `
        SELECT COUNT(*)::int as count 
        FROM "shot_jobs" 
        WHERE status = 'RUNNING' 
        AND lease_until > NOW()
      `;
            const runningCount = Number(runningCountResult[0]?.count || 0);
            if (runningCount >= jobMaxInFlight) {
                this.logger.warn(`[JobService] Backpressure: concurrency limit reached (${runningCount}/${jobMaxInFlight}). Rejecting claim for workerId=${workerId}`);
                return null;
            }
            const supportedEngines = caps?.supportedEngines || [];
            const filterTypes = jobType ? [jobType] : caps?.supportedJobTypes || [];
            const candidates = await tx.$queryRaw `
        SELECT j.id, j."organizationId", jeb."engineKey"
        FROM "shot_jobs" j
        LEFT JOIN "job_engine_bindings" jeb ON jeb."jobId" = j.id
        WHERE j.status = 'PENDING'
        AND (j.lease_until IS NULL OR j.lease_until < NOW())
        ${filterTypes.length > 0
                ? database_1.Prisma.sql `AND j."type"::text IN (${database_1.Prisma.join(filterTypes)})`
                : database_1.Prisma.empty}
        ${supportedEngines.length > 0
                ? database_1.Prisma.sql `AND (jeb."engineKey" IS NULL OR jeb."engineKey" IN (${database_1.Prisma.join(supportedEngines)}))`
                : database_1.Prisma.empty}
        ORDER BY j.priority DESC, j."createdAt" ASC
        LIMIT 10
        FOR UPDATE OF j SKIP LOCKED
      `;
            if (candidates.length === 0) {
                return null;
            }
            let selectedJobId = null;
            let targetOrganizationId = null;
            let targetEngineKey = null;
            if (scuEnv.concurrencyLimiterEnabled) {
                for (const cand of candidates) {
                    const orgId = cand.organizationId;
                    const eKey = cand.engineKey;
                    if (orgId) {
                        const tenantRunningResult = await tx.$queryRaw `
              SELECT COUNT(*)::int as count FROM "shot_jobs" 
              WHERE "organizationId" = ${orgId} AND status = 'RUNNING' AND lease_until > NOW()
            `;
                        if (Number(tenantRunningResult[0]?.count || 0) >= scuEnv.maxInFlightTenant) {
                            continue;
                        }
                    }
                    if (eKey) {
                        const engineLimit = scuEnv.getEngineConcurrency(eKey);
                        const engineRunningResult = await tx.$queryRaw `
              SELECT COUNT(*)::int as count FROM "shot_jobs" j
              JOIN "job_engine_bindings" jeb ON jeb."jobId" = j.id
              WHERE jeb."engineKey" = ${eKey} AND j.status = 'RUNNING' AND j.lease_until > NOW()
            `;
                        if (Number(engineRunningResult[0]?.count || 0) >= engineLimit) {
                            continue;
                        }
                    }
                    selectedJobId = cand.id;
                    targetOrganizationId = orgId;
                    targetEngineKey = eKey;
                    break;
                }
            }
            else {
                selectedJobId = candidates[0].id;
                targetOrganizationId = candidates[0].organizationId;
                targetEngineKey = candidates[0].engineKey;
            }
            if (!selectedJobId) {
                this.logger.debug(`[JobService] Candidates found but all hit concurrency limits for worker ${workerId}`);
                return null;
            }
            this.logger.log(`[JobService] getAndMarkNextPendingJob: workerId=${workerId} running=${runningCount}/${jobMaxInFlight} selectedJobId=${selectedJobId}`);
            const now = new Date();
            const leaseExpiration = new Date(now.getTime() + jobLeaseTtlMs);
            const claimedJobs = await tx.$queryRaw `
        UPDATE "shot_jobs"
        SET 
          status = 'RUNNING',
          "workerId" = (SELECT id FROM "worker_nodes" WHERE "workerId" = ${workerId}),
          "locked_by" = ${workerId},
          "lease_until" = ${leaseExpiration},
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
        WHERE id = ${selectedJobId}
        RETURNING *
      `;
            if (claimedJobs.length > 0) {
                this.logger.log(`[JobService] Claimed job ${claimedJobs[0].id} for worker ${workerId}`);
            }
            else {
                this.logger.log(`[JobService] No jobs to claim for worker ${workerId} (types=${filterTypes.length}, query engines=${supportedEngines.length})`);
                return null;
            }
            const job = claimedJobs[0];
            this.logger.log(JSON.stringify({
                event: 'JOB_CLAIMED_SUCCESS_ATOMIC',
                jobId: job.id,
                workerId,
                jobType: job.type,
                attempts: job.attempts,
                leaseUntil: job.leaseUntil,
                timestamp: new Date().toISOString(),
            }));
            return tx.shotJob.findUnique({
                where: { id: job.id },
                include: {
                    task: true,
                    shot: {
                        include: {
                            scene: {
                                include: {
                                    episode: {
                                        include: {
                                            season: {
                                                include: {
                                                    project: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });
    }
    async processJob(jobId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: {
                shot: {
                    include: {
                        scene: {
                            include: { episode: { include: { season: { include: { project: true } } } } },
                        },
                    },
                },
                task: true,
                worker: true,
                engineBinding: {
                    include: {
                        engine: true,
                    },
                },
            },
        });
        if (!job)
            return;
        if (job.status === exports.JobStatusEnum.PENDING) {
            (0, job_rules_1.transitionJobStatus)(exports.JobStatusEnum.PENDING, exports.JobStatusEnum.DISPATCHED, {
                jobId: job.id,
                jobType: job.type,
                workerId: 'internal-api-worker',
            });
            await this.prisma.shotJob.update({
                where: { id: jobId },
                data: { status: exports.JobStatusEnum.RUNNING },
            });
        }
        else if (job.status !== exports.JobStatusEnum.RUNNING) {
            return;
        }
        const startTime = Date.now();
        try {
            let engineKey = job.engineBinding?.engine?.engineKey;
            if (!engineKey) {
                if (job.type === exports.JobTypeEnum.NOVEL_ANALYSIS) {
                    engineKey = 'default_novel_analysis';
                }
                else if (job.type === exports.JobTypeEnum.VIDEO_RENDER) {
                    engineKey = 'default_video_render';
                }
            }
            if (!engineKey) {
                throw new Error(`No engine bound and no default found for job type: ${job.type} `);
            }
            const adapter = this.engineRegistry.getAdapter(engineKey);
            if (!adapter) {
                throw new Error(`Engine adapter not found for key: ${engineKey} `);
            }
            this.logger.log(`[JobService] Executing job ${jobId} with engine ${engineKey} `);
            const result = await adapter.invoke(job);
            await this.reportJobResult(job.id, exports.JobStatusEnum.SUCCEEDED, result, undefined, job.payload?.userId, undefined, 'internal-api-worker');
            const duration = Date.now() - startTime;
            this.logger.log(`[JobService] Job ${jobId} finished in ${duration} ms`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`[JobService] Job ${jobId} failed in ${duration} ms: ${error.message} `, error.stack);
            await this.reportJobResult(job.id, exports.JobStatusEnum.FAILED, undefined, error.message || 'Unknown internal execution error', job.payload?.userId, undefined, 'internal-api-worker');
        }
    }
    async findByShotId(shotId, userId, organizationId) {
        await this.checkShotOwnership(shotId, userId, organizationId);
        return this.prisma.shotJob.findMany({
            where: {
                shotId,
                organizationId,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findJobById(id, userId, organizationId) {
        this.logger.log(`[DEBUG] findJobById: id = ${id} userId = ${userId} orgId = ${organizationId} `);
        const job = (await this.prisma.shotJob.findUnique({
            where: {
                id,
                organizationId,
            },
            include: {
                task: true,
                shot: {
                    include: {
                        scene: {
                            include: {
                                episode: {
                                    include: {
                                        season: {
                                            include: {
                                                project: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                engineBinding: {
                    include: {
                        engine: true,
                        engineVersion: true,
                    },
                },
            },
        }));
        if (!job) {
            this.logger.warn(`[DEBUG] Job not found by findUnique.Check orgId match.`);
            const jobAnyOrg = await this.prisma.shotJob.findUnique({ where: { id } });
            if (jobAnyOrg) {
                this.logger.warn(`[DEBUG] Job FOUND without org filter! Job Org = ${jobAnyOrg.organizationId}, Request Org = ${organizationId} `);
            }
            else {
                this.logger.warn(`[DEBUG] Job strictly NOT FOUND in DB.`);
            }
            throw new common_1.NotFoundException('Job not found');
        }
        if (job.shot) {
            const episode = job.shot.scene.episode;
            const project = await this.projectResolver.resolveProjectAuthOnly(episode);
            if (!project || project.organizationId !== organizationId) {
                this.logger.warn(`[DEBUG] Project Org Mismatch.Proj Org = ${project?.organizationId}, Request Org = ${organizationId}`);
                throw new common_1.ForbiddenException('Organization mismatch');
            }
        }
        else {
            const project = await this.prisma.project.findUnique({
                where: { id: job.projectId },
                select: { organizationId: true },
            });
            if (!project || project.organizationId !== organizationId) {
                throw new common_1.ForbiddenException('You do not have permission to access this job (Project check failed)');
            }
        }
        return job;
    }
    async listJobs(userId, organizationId, filters) {
        const { status, type, shotId, projectId, engineKey, from, to, page = 1, pageSize = 20, } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const where = {
            organizationId,
        };
        if (status) {
            where.status = status;
        }
        if (type) {
            where.type = type;
        }
        if (shotId) {
            where.shotId = shotId;
        }
        if (from || to) {
            where.timestamp = {};
            if (from) {
                where.timestamp.gte = new Date(from);
            }
            if (to) {
                where.timestamp.lte = new Date(to);
            }
        }
        if (projectId) {
            where.shot = {
                scene: {
                    episode: {
                        season: {
                            projectId,
                        },
                    },
                },
            };
        }
        else {
            where.shot = {
                scene: {
                    episode: {
                        season: {
                            project: {
                                ownerId: userId,
                            },
                        },
                    },
                },
            };
        }
        const [jobs, total] = await Promise.all([
            this.prisma.shotJob.findMany({
                where,
                include: {
                    shot: {
                        include: {
                            scene: {
                                include: {
                                    episode: {
                                        include: {
                                            season: {
                                                include: {
                                                    project: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.shotJob.count({ where }),
        ]);
        const filteredJobs = jobs.filter((job) => {
            const project = job.shot.scene.episode.season?.project;
            if (!project || project.organizationId !== organizationId) {
                return false;
            }
            if (engineKey) {
                const jobEngineKey = this.extractEngineKeyFromJob(job);
                if (jobEngineKey !== engineKey) {
                    return false;
                }
            }
            return true;
        });
        const formattedJobs = await Promise.all(filteredJobs.map(async (job) => {
            const jobEngineKey = this.extractEngineKeyFromJob(job);
            const jobEngineVersion = this.extractEngineVersionFromJob(job);
            const adapter = this.engineRegistry.getAdapter(jobEngineKey);
            const adapterName = adapter?.name || jobEngineKey;
            let finalAdapterName = adapterName;
            if (!adapter) {
                const engineConfig = await this.engineConfigStore.findByEngineKey(jobEngineKey);
                if (engineConfig?.adapterName) {
                    finalAdapterName = engineConfig.adapterName;
                }
            }
            let qualityScore = null;
            if (job.status === 'SUCCEEDED' && job.taskId) {
                try {
                    const score = this.qualityScoreService.buildQualityScoreFromJob(job, adapter, job.taskId);
                    if (score) {
                        qualityScore = {
                            score: score.quality?.score ?? null,
                            confidence: score.quality?.confidence ?? null,
                        };
                    }
                }
                catch (error) {
                }
            }
            return {
                id: job.id,
                type: job.type,
                status: job.status,
                priority: job.priority,
                attempts: job.attempts,
                maxRetry: job.maxRetry,
                retryCount: job.retryCount,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                lastError: job.lastError,
                shotId: job.shotId,
                shotTitle: job.shot.title,
                projectName: job.shot.scene.episode.season?.project?.name ?? 'Unknown',
                engineKey: jobEngineKey,
                engineVersion: jobEngineVersion,
                adapterName: finalAdapterName,
                qualityScore,
            };
        }));
        return {
            jobs: formattedJobs,
            total: filteredJobs.length,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    extractEngineKeyFromJob(job) {
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.engineKey && typeof payload.engineKey === 'string') {
                return payload.engineKey;
            }
        }
        const jobType = job?.type;
        return this.engineRegistry.getDefaultEngineKeyForJobType(jobType) || 'default_novel_analysis';
    }
    extractEngineVersionFromJob(job) {
        if (job?.payload && typeof job.payload === 'object') {
            const payload = job.payload;
            if (payload.engineVersion && typeof payload.engineVersion === 'string') {
                return payload.engineVersion;
            }
        }
        if (job?.engineConfig && typeof job.engineConfig === 'object') {
            const engineConfig = job.engineConfig;
            if (engineConfig.versionName && typeof engineConfig.versionName === 'string') {
                return engineConfig.versionName;
            }
        }
        return null;
    }
    async getEngineSummary(engineKey, projectId, userId, organizationId) {
        const where = {
            organizationId,
        };
        if (projectId) {
            where.shot = {
                scene: {
                    episode: {
                        season: {
                            projectId,
                        },
                    },
                },
            };
        }
        else {
            where.shot = {
                scene: {
                    episode: {
                        season: {
                            project: {
                                ownerId: userId,
                            },
                        },
                    },
                },
            };
        }
        const jobs = await this.prisma.shotJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 1000,
            select: {
                id: true,
                status: true,
                payload: true,
                engineConfig: true,
                type: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        const filteredJobs = jobs
            .filter((job) => {
            const jobEngineKey = this.extractEngineKeyFromJob(job);
            return jobEngineKey === engineKey;
        })
            .slice(0, 100);
        if (filteredJobs.length === 0) {
            return {
                engineKey,
                totalJobs: 0,
                avgScore: null,
                avgConfidence: null,
                successRate: 0,
                avgDurationMs: null,
                avgCostUsd: null,
            };
        }
        let totalScore = 0;
        let scoreCount = 0;
        let totalConfidence = 0;
        let confidenceCount = 0;
        let successCount = 0;
        let totalDurationMs = 0;
        let durationCount = 0;
        let totalCostUsd = 0;
        let costCount = 0;
        for (const job of filteredJobs) {
            if (job.status === exports.JobStatusEnum.SUCCEEDED) {
                successCount++;
            }
            if (job.payload && typeof job.payload === 'object') {
                const payload = job.payload;
                const result = payload.result;
                if (result) {
                    if (result.quality?.score !== null && result.quality?.score !== undefined) {
                        totalScore += result.quality.score;
                        scoreCount++;
                    }
                    if (result.quality?.confidence !== null && result.quality?.confidence !== undefined) {
                        totalConfidence += result.quality.confidence;
                        confidenceCount++;
                    }
                    if (result.metrics?.costUsd !== null && result.metrics?.costUsd !== undefined) {
                        totalCostUsd += result.metrics.costUsd;
                        costCount++;
                    }
                }
            }
            if ((job.status === exports.JobStatusEnum.SUCCEEDED || job.status === exports.JobStatusEnum.FAILED) &&
                job.createdAt &&
                job.updatedAt) {
                const durationMs = job.updatedAt.getTime() - job.createdAt.getTime();
                if (durationMs > 0) {
                    totalDurationMs += durationMs;
                    durationCount++;
                }
            }
        }
        return {
            engineKey,
            totalJobs: filteredJobs.length,
            avgScore: scoreCount > 0 ? totalScore / scoreCount : null,
            avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : null,
            successRate: filteredJobs.length > 0 ? successCount / filteredJobs.length : 0,
            avgDurationMs: durationCount > 0 ? totalDurationMs / durationCount : null,
            avgCostUsd: costCount > 0 ? totalCostUsd / costCount : null,
        };
    }
    async retryJob(jobId, userId, organizationId, resetAttempts = false) {
        const job = await this.findJobById(jobId, userId, organizationId);
        if (job.status === exports.JobStatusEnum.RUNNING) {
            throw new common_1.ForbiddenException('Cannot retry a running job. Wait for it to finish or cancel it first.');
        }
        if (job.status === exports.JobStatusEnum.SUCCEEDED) {
            throw new common_1.ForbiddenException('Cannot retry a succeeded job.');
        }
        const nextRetry = resetAttempts ? 0 : job.retryCount + 1;
        if (nextRetry >= job.maxRetry) {
            throw new common_1.ForbiddenException('Max retry reached for this job.');
        }
        (0, job_rules_1.transitionJobStatus)(job.status, exports.JobStatusEnum.RETRYING, {
            jobId: job.id,
            jobType: job.type,
            workerId: job.workerId || undefined,
        });
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.RETRYING,
                attempts: resetAttempts ? 0 : job.attempts,
                retryCount: nextRetry,
                lastError: null,
                workerId: null,
            },
        });
    }
    async cancelJob(jobId, userId, organizationId) {
        const job = await this.findJobById(jobId, userId, organizationId);
        if (job.status === exports.JobStatusEnum.SUCCEEDED) {
            throw new common_1.ForbiddenException('Cannot cancel a succeeded job.');
        }
        (0, job_rules_1.transitionJobStatusAdmin)(job.status, exports.JobStatusEnum.FAILED, {
            jobId: job.id,
            jobType: job.type,
            workerId: job.workerId || undefined,
        });
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.FAILED,
                lastError: 'Cancelled by user',
            },
        });
    }
    async forceFailJob(jobId, userId, organizationId, message) {
        const job = await this.findJobById(jobId, userId, organizationId);
        if (job.status === exports.JobStatusEnum.SUCCEEDED || job.status === exports.JobStatusEnum.FAILED) {
            throw new common_1.ForbiddenException(`Cannot force fail a job with status: ${job.status} `);
        }
        (0, job_rules_1.transitionJobStatusAdmin)(job.status, exports.JobStatusEnum.FAILED, {
            jobId: job.id,
            jobType: job.type,
            workerId: job.workerId || undefined,
        });
        const errorMessage = message || 'Manually failed by operator';
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.FAILED,
                lastError: errorMessage,
            },
        });
    }
    async batchRetry(jobIds, userId, organizationId, resetAttempts = false) {
        const results = await Promise.allSettled(jobIds.map((jobId) => this.retryJob(jobId, userId, organizationId, resetAttempts)));
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        return {
            succeeded,
            failed,
            total: jobIds.length,
        };
    }
    async batchCancel(jobIds, userId, organizationId) {
        const results = await Promise.allSettled(jobIds.map((jobId) => this.cancelJob(jobId, userId, organizationId)));
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        return {
            succeeded,
            failed,
            total: jobIds.length,
        };
    }
    async batchForceFail(jobIds, userId, organizationId, message) {
        const results = await Promise.allSettled(jobIds.map((jobId) => this.forceFailJob(jobId, userId, organizationId, message)));
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        return {
            succeeded,
            failed,
            total: jobIds.length,
        };
    }
    async getNextPendingJobForWorker(workerId) {
        const worker = await this.prisma.workerNode.findUnique({ where: { workerId } });
        if (!worker) {
            throw new common_1.NotFoundException(`Worker ${workerId} not found`);
        }
        const job = await this.prisma.shotJob.findFirst({
            where: {
                status: exports.JobStatusEnum.DISPATCHED,
                workerId: worker.id,
            },
            orderBy: { createdAt: 'asc' },
        });
        if (process.env.NODE_ENV === 'development') {
            this.logger.log(`[DEV][Job] getNextPendingJobForWorker workerId = ${workerId} jobId = ${job ? job.id : 'none'} status = ${job ? job.status : 'none'} `);
        }
        return job;
    }
    async markJobRunning(jobId, workerId) {
        const worker = await this.prisma.workerNode.findUnique({ where: { workerId } });
        if (!worker) {
            throw new common_1.NotFoundException(`Worker ${workerId} not found`);
        }
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: { worker: true },
        });
        if (!job) {
            throw new common_1.NotFoundException('Resource not found');
        }
        if (job.status === exports.JobStatusEnum.RUNNING) {
            if (job.workerId === worker.id) {
                return job;
            }
            else {
                throw new common_1.BadRequestException({
                    code: 'JOB_ALREADY_RUNNING',
                    message: `Job ${jobId} is already running by worker ${job.worker?.workerId || job.workerId} `,
                    details: {
                        jobId,
                        currentWorkerId: job.worker?.workerId || job.workerId,
                        requestedWorkerId: workerId,
                    },
                });
            }
        }
        if (job.status !== exports.JobStatusEnum.DISPATCHED) {
            throw new common_1.BadRequestException({
                code: 'JOB_STATE_VIOLATION',
                message: `Job ${jobId} is not in DISPATCHED status.Current status: ${job.status} `,
                details: {
                    jobId,
                    currentStatus: job.status,
                    requiredStatus: exports.JobStatusEnum.DISPATCHED,
                },
            });
        }
        if (job.workerId !== null && job.workerId !== worker.id) {
            throw new common_1.BadRequestException({
                code: 'JOB_WORKER_MISMATCH',
                message: `Job ${jobId} is dispatched to a different worker.Current worker: ${job.worker?.workerId || job.workerId}, Requested worker: ${workerId} `,
                details: {
                    jobId,
                    currentWorkerId: job.worker?.workerId || job.workerId,
                    requestedWorkerId: workerId,
                },
            });
        }
        const creditsObj = await this.billingService.getCredits('system', job.organizationId);
        const credits = creditsObj.remaining;
        if (credits <= 0) {
            this.logger.warn(`Job ${jobId} blocked at startup: Insufficient credits (${credits})`);
            await this.auditLogService
                .record({
                userId: job.userId,
                action: 'job.execution.blocked.quota',
                resourceType: 'job',
                resourceId: jobId,
                details: { credits, organizationId: job.organizationId },
            })
                .catch(() => undefined);
            (0, job_rules_1.transitionJobStatus)(job.status, exports.JobStatusEnum.FAILED, {
                jobId: job.id,
                jobType: job.type,
            });
            await this.prisma.shotJob.update({
                where: { id: job.id },
                data: {
                    status: exports.JobStatusEnum.FAILED,
                    lastError: 'Insufficient credits to start job execution.',
                },
            });
            throw new common_1.ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                message: 'Insufficient credits to start job execution.',
                statusCode: 402,
            });
        }
        (0, job_rules_1.transitionJobStatus)(exports.JobStatusEnum.DISPATCHED, exports.JobStatusEnum.RUNNING, {
            jobId: job.id,
            jobType: job.type,
            workerId: worker.id,
        });
        try {
            await this.jobEngineBindingService.markBindingExecuting(jobId);
        }
        catch (error) {
            this.logger.warn(`Failed to mark binding as EXECUTING for job ${jobId}: ${error.message} `);
        }
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.RUNNING,
                workerId: worker.id,
            },
        });
    }
    async markJobSucceeded(jobId, resultPayload) {
        const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
        if (!job) {
            throw new common_1.NotFoundException('Resource not found');
        }
        (0, job_rules_1.transitionJobStatus)(job.status, exports.JobStatusEnum.SUCCEEDED, {
            jobId: job.id,
            jobType: job.type,
            workerId: job.workerId || undefined,
        });
        const payload = resultPayload
            ? { ...(job.payload || {}), result: resultPayload }
            : job.payload;
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.SUCCEEDED,
                payload,
                lastError: undefined,
            },
        });
    }
    async markJobFailed(jobId, errorMessage, resultPayload) {
        const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
        if (!job) {
            throw new common_1.NotFoundException('Resource not found');
        }
        (0, job_rules_1.transitionJobStatus)(job.status, exports.JobStatusEnum.FAILED, {
            jobId: job.id,
            jobType: job.type,
            workerId: job.workerId || undefined,
        });
        const payload = resultPayload
            ? { ...(job.payload || {}), result: resultPayload }
            : job.payload;
        return this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: exports.JobStatusEnum.FAILED,
                payload,
                lastError: errorMessage || 'Job failed',
            },
        });
    }
    async handleCECoreJobCompletion(job, result) {
        const task = await this.prisma.task.findUnique({
            where: { id: job.taskId || '' },
        });
        const isOrphanedCE11 = !task && job.type === exports.JobTypeEnum.CE11_SHOT_GENERATOR;
        if (!isOrphanedCE11 &&
            (!task ||
                (task.type !== exports.TaskTypeEnum.CE_CORE_PIPELINE &&
                    task.type !== 'PIPELINE_E2E_VIDEO'))) {
            return;
        }
        const payload = task?.payload || {};
        const pipeline = payload.pipeline || (isOrphanedCE11 ? ['VIDEO_RENDER', 'CE09_MEDIA_SECURITY'] : []);
        if (job.type === exports.JobTypeEnum.CE06_NOVEL_PARSING) {
            if (result && result.data) {
                this.logger.log(`[Stage-3] CE06 SUCCEEDED, emitting event for project structure sync: ${job.projectId}`);
                this.eventEmitter.emit('job.ce06_succeeded', {
                    projectId: job.projectId,
                    result: result,
                });
            }
            if (pipeline.includes('CE03_VISUAL_DENSITY')) {
                await this.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    taskId: job.taskId,
                    jobType: exports.JobTypeEnum.CE03_VISUAL_DENSITY,
                    payload: {
                        projectId: job.projectId,
                        engineKey: 'ce03_visual_density',
                        previousJobId: job.id,
                        previousJobResult: result,
                    },
                });
                this.logger.log(`CE06 completed, triggered CE03 for project ${job.projectId}`);
            }
        }
        else if (job.type === exports.JobTypeEnum.CE03_VISUAL_DENSITY) {
            if (pipeline.includes('CE04_VISUAL_ENRICHMENT')) {
                await this.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    taskId: job.taskId,
                    jobType: exports.JobTypeEnum.CE04_VISUAL_ENRICHMENT,
                    payload: {
                        projectId: job.projectId,
                        engineKey: 'ce04_visual_enrichment',
                        previousJobId: job.id,
                        previousJobResult: result,
                    },
                });
                this.logger.log(`CE03 completed, triggered CE04 for project ${job.projectId}`);
            }
        }
        else if (job.type === exports.JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
            if (pipeline.includes('VIDEO_EXPORT') ||
                pipeline.includes('TIMELINE_RENDER') ||
                pipeline.includes('PIPELINE_TIMELINE_COMPOSE')) {
                await this.auditLogService.record({
                    action: 'CE_DAG_TRANSITION',
                    resourceType: 'job',
                    resourceId: job.id,
                    traceId: job.traceId || task?.traceId || undefined,
                    details: {
                        from: 'CE04_VISUAL_ENRICHMENT',
                        to: 'PIPELINE_TIMELINE_COMPOSE',
                        projectId: job.projectId,
                    },
                });
                await this.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    taskId: job.taskId || undefined,
                    jobType: exports.JobTypeEnum.PIPELINE_TIMELINE_COMPOSE,
                    payload: {
                        projectId: job.projectId,
                        sceneId: job.sceneId || undefined,
                        engineKey: 'timeline_compose',
                        previousJobId: job.id,
                        previousJobResult: result,
                        pipelineRunId: job.payload?.pipelineRunId || job.id,
                    },
                });
                this.logger.log(`CE04 completed, triggered PIPELINE_TIMELINE_COMPOSE for project ${job.projectId}`);
            }
        }
        else if (job.type === exports.JobTypeEnum.CE11_SHOT_GENERATOR) {
            if (pipeline.includes('VIDEO_RENDER') || pipeline.includes('VIDEO_EXPORT')) {
                const resultData = result?.output || {};
                const createdShots = resultData.shots || [];
                this.logger.log(`CE11 completed for job ${job.id}. Triggering VIDEO_RENDER for ${createdShots.length} shots.`);
                for (const shot of createdShots) {
                    await this.createCECoreJob({
                        projectId: job.projectId,
                        organizationId: job.organizationId,
                        taskId: job.taskId || undefined,
                        jobType: exports.JobTypeEnum.VIDEO_RENDER,
                        payload: {
                            projectId: job.projectId,
                            sceneId: job.sceneId,
                            shotId: shot.id,
                            engineKey: 'kling_video_gen_v1',
                            prompt: shot.visual_prompt || shot.prompt,
                            duration: shot.duration || 5,
                            originalJobId: job.id,
                            pipelineRunId: job.payload?.pipelineRunId || job.id,
                        },
                    });
                }
            }
        }
        else if (job.type === exports.JobTypeEnum.PIPELINE_TIMELINE_COMPOSE) {
            if (pipeline.includes('VIDEO_EXPORT') || pipeline.includes('TIMELINE_RENDER')) {
                const timelineStorageKey = result?.timelineStorageKey;
                if (!timelineStorageKey) {
                    this.logger.error(`[JobService] PIPELINE_TIMELINE_COMPOSE result missing timelineStorageKey for job ${job.id}`);
                    throw new Error('PIPELINE_TIMELINE_COMPOSE result missing timelineStorageKey');
                }
                await this.auditLogService.record({
                    action: 'CE_DAG_TRANSITION',
                    resourceType: 'job',
                    resourceId: job.id,
                    traceId: job.traceId || task?.traceId || undefined,
                    details: {
                        from: 'PIPELINE_TIMELINE_COMPOSE',
                        to: 'TIMELINE_RENDER',
                        projectId: job.projectId,
                    },
                });
                await this.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    taskId: job.taskId,
                    jobType: exports.JobTypeEnum.TIMELINE_RENDER,
                    payload: {
                        projectId: job.projectId,
                        sceneId: job.sceneId || undefined,
                        engineKey: 'timeline_render',
                        previousJobId: job.id,
                        previousJobResult: result,
                        timelineStorageKey: timelineStorageKey,
                        pipelineRunId: job.payload?.pipelineRunId || job.id,
                    },
                });
                this.logger.log(`PIPELINE_TIMELINE_COMPOSE completed, triggered TIMELINE_RENDER for project ${job.projectId}`);
            }
        }
        else if (job.type === exports.JobTypeEnum.SHOT_RENDER) {
            await this.handleStage1ShotCompletion(job);
        }
        else if (job.type === exports.JobTypeEnum.TIMELINE_RENDER) {
            if (pipeline.includes('CE09_MEDIA_SECURITY')) {
                await this.auditLogService.record({
                    action: 'CE_DAG_TRANSITION',
                    resourceType: 'job',
                    resourceId: job.id,
                    traceId: job.traceId || task?.traceId || undefined,
                    details: {
                        from: 'TIMELINE_RENDER',
                        to: 'CE09_MEDIA_SECURITY',
                        projectId: job.projectId,
                    },
                });
                await this.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    taskId: job.taskId,
                    jobType: exports.JobTypeEnum.CE09_MEDIA_SECURITY,
                    payload: {
                        projectId: job.projectId,
                        assetId: result?.assetId,
                        shotId: job.shotId || undefined,
                        engineKey: 'ce09_media_security',
                        previousJobId: job.id,
                        previousJobResult: result,
                        pipelineRunId: job.payload?.pipelineRunId || job.id,
                        traceId: job.traceId || task?.traceId || undefined,
                    },
                });
                this.logger.log(`TIMELINE_RENDER completed, triggered CE09 for project ${job.projectId}`);
            }
        }
        else if (job.type === exports.JobTypeEnum.CE09_MEDIA_SECURITY) {
            await this.handleShotRenderSecurityPipeline(job, result);
        }
    }
    async handleShotRenderSecurityPipeline(job, result) {
        try {
            const videoJob = await this.prisma.videoJob.findFirst({
                where: { shotId: job.shotId },
                orderBy: { createdAt: 'desc' },
            });
            if (videoJob) {
                await this.prisma.videoJob.update({
                    where: { id: videoJob.id },
                    data: {
                        securityProcessed: true,
                    },
                });
                const securityResult = result?.securityResult || {};
                const signedUrl = securityResult.signedUrl || `https://cdn.example.com/signed/${videoJob.id}.mp4`;
                const hlsUrl = securityResult.hlsPlaylistUrl || `https://cdn.example.com/hls/${videoJob.id}/master.m3u8`;
                const watermarkMode = securityResult.watermarkMode || 'visible_user_id';
                const fingerprintId = securityResult.fingerprintId || `fp_${job.id}`;
                const asset = await this.prisma.asset.create({
                    data: {
                        projectId: job.projectId,
                        ownerType: 'SHOT',
                        ownerId: job.shotId,
                        shotId: job.shotId,
                        type: 'VIDEO',
                        storageKey: `secure_videos/${videoJob.id}.mp4`,
                        signedUrl: signedUrl,
                        hlsPlaylistUrl: hlsUrl,
                        watermarkMode: watermarkMode,
                        fingerprintId: fingerprintId,
                        status: 'GENERATED',
                    },
                });
                await this.auditLogService.record({
                    action: 'CE09_SECURITY_COMPLETED',
                    resourceType: 'asset',
                    resourceId: asset.id,
                    traceId: job.traceId || undefined,
                    details: {
                        jobId: job.id,
                        videoJobId: videoJob.id,
                        securityProcessed: true,
                        watermarkMode,
                    },
                });
                this.logger.log(`CE09: VideoJob ${videoJob.id} security processed, Asset ${asset.id} created with secure URLs`);
            }
            else {
                this.logger.warn(`CE09 completed but no VideoJob found for shotId ${job.shotId}`);
            }
        }
        catch (error) {
            await this.auditLogService
                .record({
                action: 'CE09_SECURITY_PIPELINE_FAIL',
                resourceType: 'job',
                resourceId: job.id,
                traceId: job.traceId || undefined,
                details: {
                    reason: 'CE09 security pipeline failed',
                    error: error?.message || 'Unknown error',
                    shotId: job.shotId,
                    projectId: job.projectId,
                },
            })
                .catch(() => {
            });
            this.logger.warn({
                tag: 'CE09_SECURITY_PIPELINE_FAIL',
                jobId: job.id,
                shotId: job.shotId,
                error: error?.message || 'Unknown error',
            }, 'CE09 security pipeline failed');
        }
    }
    async handleCECoreJobFailure(job) {
        const task = await this.prisma.task.findUnique({
            where: { id: job.taskId || '' },
            include: { jobs: true },
        });
        if (!task || task.type !== exports.TaskTypeEnum.CE_CORE_PIPELINE) {
            return;
        }
        const payload = task.payload || {};
        const pipeline = payload.pipeline || [];
        let failedIndex = -1;
        if (job.type === exports.JobTypeEnum.CE06_NOVEL_PARSING) {
            failedIndex = 0;
        }
        else if (job.type === exports.JobTypeEnum.CE03_VISUAL_DENSITY) {
            failedIndex = 1;
        }
        else if (job.type === exports.JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
            failedIndex = 2;
        }
        if (failedIndex >= 0) {
            for (let i = failedIndex + 1; i < pipeline.length; i++) {
                const nextJobType = pipeline[i];
                const pendingJobs = task.jobs.filter((j) => j.type === nextJobType && j.status === exports.JobStatusEnum.PENDING);
                for (const pendingJob of pendingJobs) {
                    await this.prisma.shotJob.update({
                        where: { id: pendingJob.id },
                        data: {
                            status: exports.JobStatusEnum.FAILED,
                            lastError: `Previous CE Job failed: ${job.type} `,
                        },
                    });
                    if (nextJobType === exports.JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
                        const engineKey = 'ce04_visual_enrichment';
                        const traceId = pendingJob.traceId || task.traceId;
                        await this.auditLogService.record({
                            action: `CE_${engineKey.toUpperCase()} _SKIPPED`,
                            resourceType: 'job',
                            resourceId: pendingJob.id,
                            details: {
                                traceId,
                                projectId: pendingJob.projectId,
                                jobId: pendingJob.id,
                                jobType: nextJobType,
                                engineKey,
                                status: 'SKIPPED',
                                reason: `Previous CE Job failed: ${job.type} `,
                            },
                        });
                        this.logger.warn(`CE Pipeline: wrote SKIPPED audit for CE04 job ${pendingJob.id} due to ${job.type} failure`);
                    }
                    this.logger.warn(`CE Pipeline failed: marked ${nextJobType} job ${pendingJob.id} as FAILED due to ${job.type} failure`);
                }
            }
        }
    }
    async getQueueSnapshot() {
        const pending = await this.prisma.shotJob.count({
            where: { status: exports.JobStatusEnum.PENDING },
        });
        const running = await this.prisma.shotJob.count({
            where: {
                status: exports.JobStatusEnum.RUNNING,
                leaseUntil: { gt: new Date() },
            },
        });
        return {
            pending,
            running,
            timestamp: new Date().toISOString(),
        };
    }
    async handleStage1ShotCompletion(job) {
        const payload = job.payload || {};
        const pipelineRunId = payload.pipelineRunId;
        if (!pipelineRunId)
            return;
        const pipelineJob = await this.prisma.shotJob.findFirst({
            where: {
                type: exports.JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
                traceId: pipelineRunId,
            },
        });
        if (!pipelineJob)
            return;
        const remainingCount = await this.prisma.shotJob.count({
            where: {
                type: exports.JobTypeEnum.SHOT_RENDER,
                status: { notIn: [exports.JobStatusEnum.SUCCEEDED, exports.JobStatusEnum.FAILED] },
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
        });
        if (remainingCount === 0) {
            this.logger.log(`[Stage-1] All shots completed for run ${pipelineRunId}. Triggering Assemble...`);
            await this.triggerStage1PipelineAssemble(pipelineRunId, job.projectId, job.organizationId);
        }
    }
    async triggerStage1PipelineAssemble(pipelineRunId, projectId, organizationId) {
        const succeededShots = await this.prisma.shotJob.findMany({
            where: {
                status: exports.JobStatusEnum.SUCCEEDED,
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
            include: { shot: true },
            orderBy: { shot: { index: 'asc' } },
        });
        if (succeededShots.length === 0) {
            this.logger.warn(`[Stage-1] No succeeded shots found for run ${pipelineRunId} to assemble.`);
            return;
        }
        this.logger.log(`[Stage-1] Found ${succeededShots.length} succeeded shots for run ${pipelineRunId}`);
        const frames = succeededShots
            .map((sj) => sj.payload?.result?.output?.storageKey || sj.payload?.result?.storageKey)
            .filter(Boolean);
        if (frames.length === 0) {
            this.logger.warn(`[Stage-1] No frames found for assembly in run ${pipelineRunId}`);
            return;
        }
        const placeholderShot = await this.prisma.shot.findFirst({
            where: {
                type: 'pipeline_stage1',
                scene: { episode: { projectId } },
            },
        });
        const targetShotId = placeholderShot?.id || succeededShots[0].shotId;
        const isVerification = succeededShots[0]?.isVerification || false;
        if (!targetShotId) {
            this.logger.error(`[Stage-1] targetShotId is null, cannot assembly video. Run ${pipelineRunId}`);
            return;
        }
        await this.ensureVideoRenderJob(targetShotId, frames, pipelineRunId, 'system', organizationId, isVerification);
        this.logger.log(`[Stage-1] Triggered VIDEO_RENDER for pipelineRunId=${pipelineRunId}, isVerification=${isVerification}`);
    }
    async handleStage1VideoCompletion(job, result) {
        const payload = job.payload || {};
        const pipelineRunId = payload.pipelineRunId;
        if (!pipelineRunId)
            return;
        const pipelineJob = await this.prisma.shotJob.findFirst({
            where: {
                type: exports.JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
                traceId: pipelineRunId,
            },
        });
        if (!pipelineJob)
            return;
        this.logger.log(`[Stage-1] VIDEO_RENDER completed for run ${pipelineRunId}. Recording Internal Publication...`);
        const assetId = result?.output?.assetId || result?.assetId;
        const storageKey = result?.output?.storageKey || result?.storageKey;
        if (!assetId || !storageKey) {
            this.logger.warn(`[Stage-1] VIDEO_RENDER result missing assetId or storageKey for run ${pipelineRunId}`);
            return;
        }
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
        const checksum = asset?.checksum || 'unknown';
        await this.publishedVideoService.recordPublishedVideo({
            projectId: job.projectId,
            episodeId: job.episodeId,
            assetId,
            storageKey,
            checksum,
            pipelineRunId,
        });
        this.logger.log(`[Stage-1] Internal Publication recorded for run ${pipelineRunId} (Asset: ${assetId})`);
        await this.createCECoreJob({
            projectId: job.projectId,
            organizationId: job.organizationId,
            taskId: job.taskId,
            jobType: exports.JobTypeEnum.CE09_MEDIA_SECURITY,
            payload: {
                projectId: job.projectId,
                assetId: assetId,
                shotId: job.shotId || undefined,
                engineKey: 'ce09_media_security',
                previousJobId: job.id,
                previousJobResult: result,
                pipelineRunId: pipelineRunId,
            },
            traceId: pipelineRunId,
        });
        this.logger.log(`[Stage-1] Triggered CE09_MEDIA_SECURITY for run ${pipelineRunId} (Asset: ${assetId})`);
    }
    async triggerQualityHookAfterPersist(params) {
        const { jobId, jobType, status, projectId, shotId, traceId } = params;
        const forceSync = process.env.GATE_MODE === '1' || process.env.QUALITY_HOOK_SYNC_FOR_GATE === '1';
        const run = async () => {
            if (status !== 'SUCCEEDED')
                return;
            if (jobType !== 'SHOT_RENDER')
                return;
            if (!shotId) {
                this.logger.warn(`[QUALITY_HOOK] Skip: shotId missing for job ${jobId}`);
                return;
            }
            const enabled = await this.featureFlagService.isAutoReworkEnabled({
                projectId,
                orgId: undefined,
            });
            this.logger.log(`[QUALITY_HOOK] decide enabled=${enabled} jobId=${jobId} projectId=${projectId} shotId=${shotId}`);
            if (!enabled)
                return;
            await this.qualityScoreService.performScoring(shotId, traceId || '', 1);
        };
        const safeRun = async () => {
            try {
                await run();
            }
            catch (e) {
                this.logger.error(`[QUALITY_HOOK] failed jobId=${jobId} shotId=${shotId} err=${e?.message}`, e?.stack);
            }
        };
        if (forceSync) {
            this.logger.log(`[QUALITY_HOOK] Sync mode for job ${jobId}`);
            await safeRun();
        }
        else {
            this.logger.log(`[QUALITY_HOOK] Async mode for job ${jobId}`);
            setImmediate(() => void safeRun());
        }
    }
};
exports.JobService = JobService;
exports.JobService = JobService = JobService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => task_service_1.TaskService))),
    __param(2, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(3, (0, common_1.Inject)(engine_registry_service_1.EngineRegistry)),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => quality_score_service_1.QualityScoreService))),
    __param(5, (0, common_1.Inject)(engine_config_store_service_1.EngineConfigStoreService)),
    __param(6, (0, common_1.Inject)(job_engine_binding_service_1.JobEngineBindingService)),
    __param(7, (0, common_1.Inject)(billing_service_1.BillingService)),
    __param(8, (0, common_1.Inject)(copyright_service_1.CopyrightService)),
    __param(9, (0, common_1.Inject)(capacity_gate_service_1.CapacityGateService)),
    __param(10, (0, common_1.Inject)(feature_flag_service_1.FeatureFlagService)),
    __param(11, (0, common_1.Inject)(text_safety_service_1.TextSafetyService)),
    __param(12, (0, common_1.Inject)(budget_service_1.BudgetService)),
    __param(13, (0, common_1.Inject)(published_video_service_1.PublishedVideoService)),
    __param(14, (0, common_1.Inject)(event_emitter_1.EventEmitter2)),
    __param(15, (0, common_1.Inject)(financial_settlement_service_1.FinancialSettlementService)),
    __param(16, (0, common_1.Inject)((0, common_1.forwardRef)(() => project_resolver_1.ProjectResolver))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_service_1.TaskService,
        audit_log_service_1.AuditLogService,
        engine_registry_service_1.EngineRegistry,
        quality_score_service_1.QualityScoreService,
        engine_config_store_service_1.EngineConfigStoreService,
        job_engine_binding_service_1.JobEngineBindingService,
        billing_service_1.BillingService,
        copyright_service_1.CopyrightService,
        capacity_gate_service_1.CapacityGateService,
        feature_flag_service_1.FeatureFlagService,
        text_safety_service_1.TextSafetyService,
        budget_service_1.BudgetService,
        published_video_service_1.PublishedVideoService,
        event_emitter_1.EventEmitter2,
        financial_settlement_service_1.FinancialSettlementService,
        project_resolver_1.ProjectResolver,
        job_auth_ops_service_1.JobAuthOpsService,
        job_creation_ops_service_1.JobCreationOpsService,
        job_update_ops_service_1.JobUpdateOpsService])
], JobService);
//# sourceMappingURL=job.service.js.map