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
var TextService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextService = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("../job/job.service");
const prisma_service_1 = require("../prisma/prisma.service");
const text_safety_service_1 = require("./text-safety.service");
const quality_metrics_writer_1 = require("../quality/quality-metrics.writer");
const database_1 = require("database");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const audit_constants_1 = require("../audit/audit.constants");
const crypto_1 = require("crypto");
let TextService = TextService_1 = class TextService {
    jobService;
    prisma;
    textSafetyService;
    auditLogService;
    qualityMetricsWriter;
    logger = new common_1.Logger(TextService_1.name);
    constructor(jobService, prisma, textSafetyService, auditLogService, qualityMetricsWriter) {
        this.jobService = jobService;
        this.prisma = prisma;
        this.textSafetyService = textSafetyService;
        this.auditLogService = auditLogService;
        this.qualityMetricsWriter = qualityMetricsWriter;
    }
    async visualDensity(dto, userId, organizationId, ip, userAgent) {
        if (!dto.text || dto.text.trim().length === 0) {
            throw new common_1.BadRequestException('text is required and cannot be empty');
        }
        const project = await this.prisma.project.findUnique({
            where: { id: dto.projectId },
        });
        if (!project) {
            throw new common_1.BadRequestException(`Project ${dto.projectId} not found`);
        }
        if (organizationId && project.organizationId !== organizationId) {
            throw new common_1.BadRequestException(`Project ${dto.projectId} does not belong to organization ${organizationId}`);
        }
        const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        if (!organizationId) {
            throw new common_1.BadRequestException('organizationId is required');
        }
        const task = await this.prisma.task.create({
            data: {
                projectId: dto.projectId,
                organizationId,
                type: database_1.TaskType.CE_CORE_PIPELINE,
                status: 'PENDING',
                traceId,
                payload: {
                    pipeline: ['CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
                    input: {
                        text: dto.text,
                        sceneId: dto.sceneId,
                        shotId: dto.shotId,
                    },
                },
            },
        });
        const job = await this.jobService.createCECoreJob({
            projectId: dto.projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE03_VISUAL_DENSITY,
            payload: {
                projectId: dto.projectId,
                engineKey: 'ce03_visual_density',
                text: dto.text,
                sceneId: dto.sceneId,
                shotId: dto.shotId,
                traceId,
            },
        });
        await this.auditLogService.record({
            userId,
            action: audit_constants_1.AuditActions.JOB_CREATED,
            resourceType: 'job',
            resourceId: job.id,
            ip,
            userAgent,
            details: {
                jobType: 'CE03_VISUAL_DENSITY',
                taskId: task.id,
                traceId,
                projectId: dto.projectId,
            },
        });
        this.logger.log(`CE03 Job created: ${job.id}, traceId: ${traceId}`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
            taskId: task.id,
        };
    }
    async visualEnrich(dto, userId, organizationId, ip, userAgent) {
        if (!dto.text || dto.text.trim().length === 0) {
            throw new common_1.BadRequestException('text is required and cannot be empty');
        }
        const project = await this.prisma.project.findUnique({
            where: { id: dto.projectId },
        });
        if (!project) {
            throw new common_1.BadRequestException(`Project ${dto.projectId} not found`);
        }
        if (organizationId && project.organizationId !== organizationId) {
            throw new common_1.BadRequestException(`Project ${dto.projectId} does not belong to organization ${organizationId}`);
        }
        const safetyResult = await this.textSafetyService.sanitize(dto.text, userId, ip, userAgent);
        if (!safetyResult.passed) {
            if (!organizationId) {
                throw new common_1.BadRequestException('organizationId is required');
            }
            const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
            const task = await this.prisma.task.create({
                data: {
                    projectId: dto.projectId,
                    organizationId,
                    type: database_1.TaskType.CE_CORE_PIPELINE,
                    status: 'FAILED',
                    traceId,
                    payload: {
                        pipeline: ['CE04_VISUAL_ENRICHMENT'],
                        input: {
                            text: dto.text,
                            sceneId: dto.sceneId,
                            shotId: dto.shotId,
                        },
                        safetyCheck: {
                            passed: false,
                            flags: safetyResult.flags,
                            sanitizedText: safetyResult.sanitizedText,
                        },
                    },
                },
            });
            const job = await this.jobService.createCECoreJob({
                projectId: dto.projectId,
                organizationId,
                taskId: task.id,
                jobType: database_1.JobType.CE04_VISUAL_ENRICHMENT,
                payload: {
                    projectId: dto.projectId,
                    engineKey: 'ce04_visual_enrichment',
                    text: dto.text,
                    sceneId: dto.sceneId,
                    shotId: dto.shotId,
                    traceId,
                    safetyCheck: {
                        passed: false,
                        flags: safetyResult.flags,
                        sanitizedText: safetyResult.sanitizedText,
                    },
                },
            });
            await this.prisma.shotJob.update({
                where: { id: job.id },
                data: {
                    status: database_1.JobStatus.FAILED,
                    lastError: `Safety check failed: ${safetyResult.flags.join(', ')}`,
                },
            });
            await this.auditLogService.record({
                userId,
                action: audit_constants_1.AuditActions.JOB_CREATED,
                resourceType: 'job',
                resourceId: job.id,
                ip,
                userAgent,
                details: {
                    jobType: 'CE04_VISUAL_ENRICHMENT',
                    taskId: task.id,
                    traceId,
                    projectId: dto.projectId,
                    status: 'FAILED',
                    reason: 'SAFETY_CHECK_FAILED',
                    safetyCheck: {
                        passed: false,
                        flags: safetyResult.flags,
                        originalText: dto.text,
                        sanitizedText: safetyResult.sanitizedText,
                    },
                },
            });
            this.logger.warn(`CE04 Job rejected due to safety check: ${job.id}, flags: ${safetyResult.flags.join(', ')}`);
            return {
                jobId: job.id,
                traceId,
                status: 'FAILED',
                taskId: task.id,
                reason: 'SAFETY_CHECK_FAILED',
                safetyFlags: safetyResult.flags,
            };
        }
        const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        if (!organizationId) {
            throw new common_1.BadRequestException('organizationId is required');
        }
        const task = await this.prisma.task.create({
            data: {
                projectId: dto.projectId,
                organizationId,
                type: database_1.TaskType.CE_CORE_PIPELINE,
                status: 'PENDING',
                traceId,
                payload: {
                    pipeline: ['CE04_VISUAL_ENRICHMENT'],
                    input: {
                        text: safetyResult.sanitizedText,
                        sceneId: dto.sceneId,
                        shotId: dto.shotId,
                        previousJobId: dto.previousJobId,
                    },
                    safetyCheck: {
                        passed: true,
                        flags: safetyResult.flags,
                        sanitizedText: safetyResult.sanitizedText,
                    },
                },
            },
        });
        const job = await this.jobService.createCECoreJob({
            projectId: dto.projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE04_VISUAL_ENRICHMENT,
            payload: {
                projectId: dto.projectId,
                engineKey: 'ce04_visual_enrichment',
                text: safetyResult.sanitizedText,
                sceneId: dto.sceneId,
                shotId: dto.shotId,
                previousJobId: dto.previousJobId,
                traceId,
                safetyCheck: {
                    passed: true,
                    flags: safetyResult.flags,
                },
            },
        });
        await this.auditLogService.record({
            userId,
            action: audit_constants_1.AuditActions.JOB_CREATED,
            resourceType: 'job',
            resourceId: job.id,
            ip,
            userAgent,
            details: {
                jobType: 'CE04_VISUAL_ENRICHMENT',
                taskId: task.id,
                traceId,
                projectId: dto.projectId,
                safetyCheck: {
                    passed: true,
                    flags: safetyResult.flags,
                    originalText: dto.text,
                    sanitizedText: safetyResult.sanitizedText,
                },
            },
        });
        this.logger.log(`CE04 Job created: ${job.id}, traceId: ${traceId}`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
            taskId: task.id,
        };
    }
};
exports.TextService = TextService;
exports.TextService = TextService = TextService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService,
        text_safety_service_1.TextSafetyService,
        audit_log_service_1.AuditLogService,
        quality_metrics_writer_1.QualityMetricsWriter])
], TextService);
//# sourceMappingURL=text.service.js.map