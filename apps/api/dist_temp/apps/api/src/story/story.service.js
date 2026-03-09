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
var StoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoryService = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("../job/job.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const audit_constants_1 = require("../audit/audit.constants");
const crypto_1 = require("crypto");
const novel_import_service_1 = require("../novel-import/novel-import.service");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const SHREDDER_THRESHOLD = 500000;
let StoryService = StoryService_1 = class StoryService {
    jobService;
    prisma;
    auditLogService;
    novelImportService;
    logger = new common_1.Logger(StoryService_1.name);
    constructor(jobService, prisma, auditLogService, novelImportService) {
        this.jobService = jobService;
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.novelImportService = novelImportService;
    }
    async parseStory(dto, userId, organizationId, ip, userAgent, targetTraceId, isVerification) {
        console.log('[StoryService DEBUG] parseStory dto:', JSON.stringify(dto).slice(0, 100));
        const projectId = dto.projectId;
        this.logger.log(`Parsing story for project ${projectId}, isVerification=${isVerification}`);
        if (!dto.rawText || dto.rawText.trim().length === 0) {
            throw new common_1.BadRequestException('rawText is required and cannot be empty');
        }
        if (projectId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId },
            });
            if (!project) {
                throw new common_1.BadRequestException(`Project ${projectId} not found`);
            }
            if (organizationId && project.organizationId !== organizationId) {
                throw new common_1.BadRequestException(`Project ${projectId} does not belong to organization ${organizationId}`);
            }
        }
        else {
            throw new common_1.BadRequestException('projectId is required');
        }
        const traceId = targetTraceId || `ce_pipeline_${(0, crypto_1.randomUUID)()}`;
        if (dto.rawText.length > SHREDDER_THRESHOLD) {
            this.logger.log(`[Stage 4] Text length ${dto.rawText.length} exceeds threshold ${SHREDDER_THRESHOLD}, bypassing monolithic parsing.`);
            let novel = await this.prisma.novel.findFirst({ where: { projectId } });
            if (!novel) {
                novel = await this.prisma.novel.create({
                    data: {
                        projectId,
                        title: dto.title || 'Untitled Story',
                        author: dto.author || 'Unknown',
                        rawFileUrl: '',
                        status: 'UPLOADING',
                    },
                });
            }
            const uploadDir = path.join(process.cwd(), 'uploads/novels');
            await fs.mkdir(uploadDir, { recursive: true });
            const filePath = path.join(uploadDir, `shredder_${projectId}_${Date.now()}.txt`);
            await fs.writeFile(filePath, dto.rawText);
            const result = await this.novelImportService.triggerShredderWorkflow(novel.id, projectId, organizationId, userId || 'system', filePath, dto.title || 'Untitled Story', traceId, isVerification);
            await this.auditLogService.record({
                userId,
                action: audit_constants_1.AuditActions.JOB_CREATED,
                resourceType: 'job',
                resourceId: result.jobId,
                ip,
                userAgent,
                details: {
                    jobType: 'NOVEL_SCAN_TOC',
                    mode: 'SHREDDER',
                    taskId: result.taskId,
                    traceId,
                    projectId,
                },
            });
            return {
                jobId: result.jobId,
                traceId,
                status: 'PENDING',
                taskId: result.taskId,
            };
        }
        const novel = await this.prisma.novel.findFirst({ where: { projectId } });
        if (!novel) {
            await this.prisma.novel.create({
                data: {
                    projectId,
                    title: dto.title || 'Untitled Story',
                    author: dto.author || 'Unknown',
                    rawFileUrl: '',
                },
            });
        }
        else {
            await this.prisma.novel.update({
                where: { id: novel.id },
                data: {
                    title: dto.title,
                    author: dto.author,
                },
            });
        }
        if (!organizationId) {
            throw new common_1.BadRequestException('organizationId is required');
        }
        const task = await this.prisma.task.create({
            data: {
                projectId,
                organizationId,
                type: database_1.TaskType.PIPELINE_E2E_VIDEO,
                status: 'PENDING',
                traceId,
                payload: {
                    pipeline: [
                        'CE06_NOVEL_PARSING',
                        'CE03_VISUAL_DENSITY',
                        'CE04_VISUAL_ENRICHMENT',
                        'VIDEO_EXPORT',
                        'CE09_MEDIA_SECURITY',
                    ],
                    input: {
                        rawText: dto.rawText,
                        title: dto.title,
                        author: dto.author,
                    },
                },
            },
        });
        const job = await this.jobService.createCECoreJob({
            projectId,
            organizationId,
            taskId: task.id,
            jobType: database_1.JobType.CE06_NOVEL_PARSING,
            payload: {
                projectId,
                engineKey: 'ce06_novel_parsing',
                sourceText: dto.rawText,
                title: dto.title,
                author: dto.author,
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
                jobType: 'CE06_NOVEL_PARSING',
                taskId: task.id,
                traceId,
                projectId,
            },
        });
        this.logger.log(`CE06 Job created: ${job.id}, traceId: ${traceId}`);
        return {
            jobId: job.id,
            traceId,
            status: job.status,
            taskId: task.id,
        };
    }
};
exports.StoryService = StoryService;
exports.StoryService = StoryService = StoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        novel_import_service_1.NovelImportService])
], StoryService);
//# sourceMappingURL=story.service.js.map