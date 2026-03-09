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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JobCreationOpsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobCreationOpsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const job_engine_binding_service_1 = require("./job-engine-binding.service");
const billing_service_1 = require("../billing/billing.service");
const capacity_gate_service_1 = require("../capacity/capacity-gate.service");
const budget_service_1 = require("../billing/budget.service");
const feature_flag_service_1 = require("../feature-flag/feature-flag.service");
const text_safety_service_1 = require("../text-safety/text-safety.service");
const published_video_service_1 = require("../publish/published-video.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const financial_settlement_service_1 = require("../billing/financial-settlement.service");
const job_auth_ops_service_1 = require("./job-auth-ops.service");
const database_1 = require("database");
const task_service_1 = require("../task/task.service");
const project_resolver_1 = require("../common/project-resolver");
let JobCreationOpsService = JobCreationOpsService_1 = class JobCreationOpsService {
    prisma;
    auditLogService;
    engineRegistry;
    engineConfigStore;
    jobEngineBindingService;
    billingService;
    budgetService;
    capacityGateService;
    featureFlagService;
    textSafetyService;
    publishedVideoService;
    eventEmitter;
    financialSettlementService;
    taskService;
    projectResolver;
    jobAuthOps;
    logger = new common_1.Logger(JobCreationOpsService_1.name);
    constructor(prisma, auditLogService, engineRegistry, engineConfigStore, jobEngineBindingService, billingService, budgetService, capacityGateService, featureFlagService, textSafetyService, publishedVideoService, eventEmitter, financialSettlementService, taskService, projectResolver, jobAuthOps) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.engineRegistry = engineRegistry;
        this.engineConfigStore = engineConfigStore;
        this.jobEngineBindingService = jobEngineBindingService;
        this.billingService = billingService;
        this.budgetService = budgetService;
        this.capacityGateService = capacityGateService;
        this.featureFlagService = featureFlagService;
        this.textSafetyService = textSafetyService;
        this.publishedVideoService = publishedVideoService;
        this.eventEmitter = eventEmitter;
        this.financialSettlementService = financialSettlementService;
        this.taskService = taskService;
        this.projectResolver = projectResolver;
        this.jobAuthOps = jobAuthOps;
    }
    async create(shotId, createJobDto, userId, organizationId, taskId) {
        this.logger.log(`[JobCreationOps.create] START: type=${createJobDto.type} shotId=${shotId} orgId=${organizationId}`);
        try {
            if (createJobDto.dedupeKey) {
                const existing = await this.prisma.shotJob.findUnique({
                    where: { dedupeKey: createJobDto.dedupeKey },
                });
                if (existing)
                    return existing;
            }
            if (this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE')) {
                const payload = (createJobDto.payload || {});
                const textToCheck = payload.enrichedText ?? payload.promptText ?? payload.rawText ?? payload.text ?? null;
                if (textToCheck) {
                    const traceId = payload.traceId || (0, crypto_1.randomUUID)();
                    const tempJobId = (0, crypto_1.randomUUID)();
                    const safetyResult = await this.textSafetyService.sanitize(textToCheck, {
                        projectId: createJobDto.payload?.projectId || shotId,
                        userId,
                        orgId: organizationId,
                        traceId,
                        resourceType: 'JOB',
                        resourceId: tempJobId,
                    });
                    if (safetyResult.decision === 'BLOCK' &&
                        this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE')) {
                        throw new common_1.UnprocessableEntityException({
                            statusCode: 422,
                            error: 'Unprocessable Entity',
                            message: 'Job creation blocked by safety check',
                            code: 'TEXT_SAFETY_VIOLATION',
                            details: { decision: safetyResult.decision },
                        });
                    }
                }
            }
            const shot = await this.jobAuthOps.checkShotOwnership(shotId, organizationId);
            const scene = shot.scene;
            const episode = scene?.episode;
            const project = await this.projectResolver.resolveProjectAuthOnly(episode);
            if (!scene || !episode || !project) {
                throw new common_1.NotFoundException('Shot hierarchy is incomplete');
            }
            let requiredCredits = 0;
            if (createJobDto.type === 'VIDEO_RENDER')
                requiredCredits = 10;
            else if (createJobDto.type === 'SHOT_RENDER')
                requiredCredits = 2;
            if (requiredCredits > 0) {
                const traceId = `JOB_CREATE_${shotId}_${createJobDto.type}_${Date.now()}`;
                await this.billingService.consumeCredits(project.id, userId, organizationId, requiredCredits, createJobDto.type, traceId);
            }
            if (createJobDto.type === 'SHOT_RENDER') {
                const referenceSheetId = createJobDto.payload?.referenceSheetId;
                await this.validateReferenceSheetId(referenceSheetId, organizationId, project.id, createJobDto.isVerification);
            }
            const finalTaskId = taskId ||
                (await this.taskService.create({
                    organizationId,
                    projectId: project.id,
                    type: 'SHOT_RENDER',
                    status: 'PENDING',
                    payload: { shotId, jobType: createJobDto.type, ...createJobDto.payload },
                })).id;
            return await this.prisma.$transaction(async (tx) => {
                const createdJob = await tx.shotJob.create({
                    data: {
                        organizationId,
                        projectId: project.id,
                        episodeId: episode.id,
                        sceneId: scene.id,
                        shotId,
                        taskId: finalTaskId,
                        type: createJobDto.type,
                        status: 'PENDING',
                        priority: 0,
                        maxRetry: 3,
                        payload: createJobDto.payload ?? {},
                        engineConfig: createJobDto.engineConfig ?? {},
                        traceId: createJobDto.traceId,
                        isVerification: createJobDto.isVerification || false,
                        dedupeKey: createJobDto.dedupeKey,
                    },
                });
                const engineSelection = await this.jobEngineBindingService.selectEngineForJob(createJobDto.type);
                if (!engineSelection) {
                    throw new common_1.BadRequestException(`No engine available for job type: ${createJobDto.type}`);
                }
                await tx.jobEngineBinding.create({
                    data: {
                        jobId: createdJob.id,
                        engineId: engineSelection.engineId,
                        engineKey: engineSelection.engineKey,
                        engineVersionId: engineSelection.engineVersionId,
                        status: database_1.JobEngineBindingStatus.BOUND,
                    },
                });
                return createdJob;
            });
        }
        catch (err) {
            if (err instanceof common_1.NotFoundException || err instanceof common_1.BadRequestException || err instanceof common_1.UnprocessableEntityException || err instanceof common_1.ForbiddenException) {
                throw err;
            }
            this.logger.error(`JobCreationOps.create FAILED: ${err.message}`);
            throw err;
        }
    }
    async validateReferenceSheetId(referenceSheetId, organizationId, projectId, isVerification = false) {
        if (isVerification)
            return;
        if (referenceSheetId === 'gate-mock-ref-id')
            return;
        if (!referenceSheetId) {
            throw new common_1.BadRequestException('referenceSheetId is required for SHOT_RENDER');
        }
        const rs = await this.prisma.jobEngineBinding.findFirst({
            where: {
                id: referenceSheetId,
                job: {
                    organizationId,
                    projectId,
                },
            },
        });
        if (!rs) {
            throw new common_1.ForbiddenException('Invalid referenceSheetId or cross-tenant access');
        }
    }
};
exports.JobCreationOpsService = JobCreationOpsService;
exports.JobCreationOpsService = JobCreationOpsService = JobCreationOpsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(2, (0, common_1.Inject)(engine_registry_service_1.EngineRegistry)),
    __param(3, (0, common_1.Inject)(engine_config_store_service_1.EngineConfigStoreService)),
    __param(4, (0, common_1.Inject)(job_engine_binding_service_1.JobEngineBindingService)),
    __param(5, (0, common_1.Inject)(billing_service_1.BillingService)),
    __param(6, (0, common_1.Inject)(budget_service_1.BudgetService)),
    __param(7, (0, common_1.Inject)(capacity_gate_service_1.CapacityGateService)),
    __param(8, (0, common_1.Inject)(feature_flag_service_1.FeatureFlagService)),
    __param(9, (0, common_1.Inject)(text_safety_service_1.TextSafetyService)),
    __param(10, (0, common_1.Inject)(published_video_service_1.PublishedVideoService)),
    __param(11, (0, common_1.Inject)(event_emitter_1.EventEmitter2)),
    __param(12, (0, common_1.Inject)(financial_settlement_service_1.FinancialSettlementService)),
    __param(13, (0, common_1.Inject)((0, common_1.forwardRef)(() => task_service_1.TaskService))),
    __param(14, (0, common_1.Inject)((0, common_1.forwardRef)(() => project_resolver_1.ProjectResolver))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        engine_registry_service_1.EngineRegistry,
        engine_config_store_service_1.EngineConfigStoreService,
        job_engine_binding_service_1.JobEngineBindingService,
        billing_service_1.BillingService,
        budget_service_1.BudgetService,
        capacity_gate_service_1.CapacityGateService,
        feature_flag_service_1.FeatureFlagService,
        text_safety_service_1.TextSafetyService,
        published_video_service_1.PublishedVideoService,
        event_emitter_1.EventEmitter2,
        financial_settlement_service_1.FinancialSettlementService,
        task_service_1.TaskService,
        project_resolver_1.ProjectResolver,
        job_auth_ops_service_1.JobAuthOpsService])
], JobCreationOpsService);
//# sourceMappingURL=job-creation-ops.service.js.map