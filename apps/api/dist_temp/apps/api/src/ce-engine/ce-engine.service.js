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
var CEEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEEngineService = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("../job/job.service");
const task_service_1 = require("../task/task.service");
const text_safety_service_1 = require("../text-safety/text-safety.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const crypto_1 = require("crypto");
let CEEngineService = CEEngineService_1 = class CEEngineService {
    jobService;
    taskService;
    textSafetyService;
    prisma;
    logger = new common_1.Logger(CEEngineService_1.name);
    constructor(jobService, taskService, textSafetyService, prisma) {
        this.jobService = jobService;
        this.taskService = taskService;
        this.textSafetyService = textSafetyService;
        this.prisma = prisma;
    }
    async parseStory(dto, userId, organizationId, apiKeyId) {
        const project = await this.prisma.project.findUnique({
            where: { id: dto.projectId },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${dto.projectId} not found`);
        }
        const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        const task = await this.taskService.create({
            organizationId,
            projectId: dto.projectId,
            type: database_1.TaskType.CE_CORE_PIPELINE,
            payload: {
                pipeline: [
                    'CE06_NOVEL_PARSING',
                    'CE03_VISUAL_DENSITY',
                    'CE04_VISUAL_ENRICHMENT',
                    'TIMELINE_RENDER',
                    'CE09_MEDIA_SECURITY',
                ],
                traceId,
            },
            traceId,
        });
        const job = await this.jobService.createCECoreJob({
            projectId: dto.projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE06_NOVEL_PARSING,
            payload: {
                projectId: dto.projectId,
                rawText: dto.rawText,
                engineKey: dto.options?.engineKey || 'ce06_novel_parsing',
                engineVersion: dto.options?.engineVersion,
                apiKeyId,
            },
        });
        this.logger.log(`CE06 Job created: ${job.id} for project ${dto.projectId} (apiKeyId: ${apiKeyId || 'none'})`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
        };
    }
    async analyzeVisualDensity(dto, userId, organizationId, apiKeyId) {
        const project = await this.prisma.project.findUnique({
            where: { id: dto.projectId },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${dto.projectId} not found`);
        }
        const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        const task = await this.taskService.create({
            organizationId,
            projectId: dto.projectId,
            type: database_1.TaskType.CE_CORE_PIPELINE,
            payload: {
                pipeline: ['CE03_VISUAL_DENSITY'],
                traceId,
            },
            traceId,
        });
        const job = await this.jobService.createCECoreJob({
            projectId: dto.projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE03_VISUAL_DENSITY,
            payload: {
                projectId: dto.projectId,
                text: dto.text,
                engineKey: dto.options?.engineKey || 'ce03_visual_density',
                engineVersion: dto.options?.engineVersion,
                apiKeyId,
            },
        });
        this.logger.log(`CE03 Job created: ${job.id} for project ${dto.projectId} (apiKeyId: ${apiKeyId || 'none'})`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
        };
    }
    async enrichText(dto, userId, organizationId, apiKeyId, ip, userAgent) {
        const project = await this.prisma.project.findUnique({
            where: { id: dto.projectId },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${dto.projectId} not found`);
        }
        const safetyResult = await this.textSafetyService.sanitize(dto.text, {
            projectId: dto.projectId,
            userId,
            apiKeyId,
            ip,
            userAgent,
        });
        if (safetyResult.decision === 'BLOCK') {
            throw new common_1.BadRequestException(`Text safety check failed: ${safetyResult.reasons.join(', ')}`);
        }
        const traceId = `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        const task = await this.taskService.create({
            organizationId,
            projectId: dto.projectId,
            type: database_1.TaskType.CE_CORE_PIPELINE,
            payload: {
                pipeline: ['CE04_VISUAL_ENRICHMENT'],
                traceId,
            },
            traceId,
        });
        const job = await this.jobService.createCECoreJob({
            projectId: dto.projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE04_VISUAL_ENRICHMENT,
            payload: {
                projectId: dto.projectId,
                text: safetyResult.sanitizedText,
                originalText: dto.text,
                flags: safetyResult.flags,
                engineKey: dto.options?.engineKey || 'ce04_visual_enrichment',
                engineVersion: dto.options?.engineVersion,
            },
        });
        this.logger.log(`CE04 Job created: ${job.id} for project ${dto.projectId} (safety check passed)`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
        };
    }
};
exports.CEEngineService = CEEngineService;
exports.CEEngineService = CEEngineService = CEEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [job_service_1.JobService,
        task_service_1.TaskService,
        text_safety_service_1.TextSafetyService,
        prisma_service_1.PrismaService])
], CEEngineService);
//# sourceMappingURL=ce-engine.service.js.map