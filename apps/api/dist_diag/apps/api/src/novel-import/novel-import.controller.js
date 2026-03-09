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
var NovelImportController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelImportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const novel_import_service_1 = require("./novel-import.service");
const file_parser_service_1 = require("./file-parser.service");
const novel_analysis_processor_service_1 = require("./novel-analysis-processor.service");
const import_novel_dto_1 = require("./dto/import-novel.dto");
const import_novel_file_dto_1 = require("./dto/import-novel-file.dto");
const project_service_1 = require("../project/project.service");
const prisma_service_1 = require("../prisma/prisma.service");
const task_service_1 = require("../task/task.service");
const engine_task_service_1 = require("../task/engine-task.service");
const job_service_1 = require("../job/job.service");
const structure_generate_service_1 = require("../project/structure-generate.service");
const scene_graph_service_1 = require("../project/scene-graph.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const database_1 = require("database");
const crypto_1 = require("crypto");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const multer_1 = require("multer");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const permissions_guard_1 = require("../auth/permissions.guard");
const permission_constants_1 = require("../permission/permission.constants");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const feature_flag_service_1 = require("../feature-flag/feature-flag.service");
const text_safety_service_1 = require("../text-safety/text-safety.service");
const common_2 = require("@nestjs/common");
let NovelImportController = NovelImportController_1 = class NovelImportController {
    novelImportService;
    fileParserService;
    analysisProcessor;
    projectService;
    prisma;
    taskService;
    engineTaskService;
    jobService;
    structureGenerateService;
    sceneGraphService;
    auditLogService;
    featureFlagService;
    textSafetyService;
    logger = new common_1.Logger(NovelImportController_1.name);
    uploadDir = path.join(process.cwd(), 'uploads', 'novels');
    SHREDDER_THRESHOLD_CHARACTERS = 1000000;
    constructor(novelImportService, fileParserService, analysisProcessor, projectService, prisma, taskService, engineTaskService, jobService, structureGenerateService, sceneGraphService, auditLogService, featureFlagService, textSafetyService) {
        this.novelImportService = novelImportService;
        this.fileParserService = fileParserService;
        this.analysisProcessor = analysisProcessor;
        this.projectService = projectService;
        this.prisma = prisma;
        this.taskService = taskService;
        this.engineTaskService = engineTaskService;
        this.jobService = jobService;
        this.structureGenerateService = structureGenerateService;
        this.sceneGraphService = sceneGraphService;
        this.auditLogService = auditLogService;
        this.featureFlagService = featureFlagService;
        this.textSafetyService = textSafetyService;
        fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
    }
    async performSafetyCheck(rawText, context) {
        const triStateOn = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE');
        if (!triStateOn) {
            return;
        }
        const blockOnImport = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT');
        const safetyResult = await this.textSafetyService.sanitize(rawText, {
            ...context,
            orgId: context.organizationId || undefined,
            resourceType: 'NOVEL_SOURCE',
            resourceId: context.traceId,
        });
        if (safetyResult.decision === 'BLOCK' && blockOnImport) {
            throw new common_2.UnprocessableEntityException({
                statusCode: 422,
                error: 'Unprocessable Entity',
                message: 'Content blocked by safety check',
                code: 'TEXT_SAFETY_VIOLATION',
                details: {
                    decision: safetyResult.decision,
                    riskLevel: safetyResult.riskLevel,
                    reasons: safetyResult.reasons,
                    flags: safetyResult.flags,
                    traceId: safetyResult.traceId,
                },
            });
        }
    }
    async importNovelFile(projectId, file, importNovelFileDto, user, organizationId, request) {
        if (!file)
            throw new common_1.BadRequestException('File is required');
        if (!organizationId)
            throw new common_1.ForbiddenException('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
        const filePath = file.path;
        const traceId = (0, crypto_1.randomUUID)();
        try {
            const initialTitle = importNovelFileDto.title ||
                this.fileParserService.extractTitleFromFileName(file.originalname) ||
                path.basename(file.originalname, path.extname(file.originalname));
            const novelSource = await this.prisma.novel.create({
                data: {
                    projectId,
                    organizationId,
                    title: initialTitle,
                    author: importNovelFileDto.author || 'Unknown',
                    status: 'PARSING',
                    metadata: {
                        originalFileName: file.originalname,
                        fileSize: file.size,
                        importType: 'FILE',
                        traceId,
                    },
                },
            });
            const analysisJob = await this.prisma.novelAnalysisJob.create({
                data: {
                    projectId,
                    novelSourceId: novelSource.id,
                    jobType: 'ANALYZE_ALL',
                    status: 'PENDING',
                },
            });
            if (file.size > 5000000) {
                const result = await this.novelImportService.triggerShredderWorkflow(novelSource.id, projectId, organizationId, user.userId, filePath, file.originalname, traceId);
                await this.prisma.novelAnalysisJob.update({
                    where: { id: analysisJob.id },
                    data: {
                        progress: {
                            message: 'Massive file detected, Shredder Scan started',
                            jobId: result.jobId,
                            taskId: result.taskId,
                            mode: 'SHREDDER',
                        },
                    },
                });
                return {
                    success: true,
                    data: {
                        jobId: result.jobId,
                        taskId: result.taskId,
                        novelSourceId: result.novelSourceId,
                        mode: 'SHREDDER',
                    },
                    message: 'Massive novel detected, Shredder scanning started',
                    requestId: (0, crypto_1.randomUUID)(),
                    timestamp: new Date().toISOString(),
                };
            }
            const parsed = await this.fileParserService.parseFile(filePath, fileExt, file.originalname);
            await this.performSafetyCheck(parsed.rawText, {
                projectId,
                userId: user.userId,
                organizationId,
                traceId,
            });
            const title = importNovelFileDto.title || parsed.title || initialTitle;
            const author = importNovelFileDto.author || parsed.author || 'Unknown';
            await this.prisma.novel.update({
                where: { id: novelSource.id },
                data: {
                    title,
                    author,
                    characterCount: parsed.characterCount,
                    chapterCount: parsed.chapterCount,
                    metadata: parsed.metadata
                        ? JSON.parse(JSON.stringify(parsed.metadata))
                        : novelSource.metadata,
                },
            });
            const volume = await this.prisma.novelVolume.create({
                data: { projectId, novelSourceId: novelSource.id, index: 1, title: '默认卷' },
            });
            for (let j = 0; j < parsed.chapters.length; j++) {
                const ch = parsed.chapters[j];
                const savedChapter = await this.prisma.novelChapter.create({
                    data: {
                        novelSourceId: novelSource.id,
                        volumeId: volume.id,
                        index: j + 1,
                        title: ch.title,
                        rawContent: ch.content,
                    },
                });
                await this.prisma.scene.create({
                    data: {
                        chapterId: savedChapter.id,
                        projectId,
                        sceneIndex: 1,
                        title: 'Scene 1',
                    },
                });
            }
            const task = await this.taskService.create({
                organizationId,
                projectId,
                type: 'NOVEL_ANALYSIS',
                status: 'PENDING',
                traceId,
            });
            const job = await this.jobService.createNovelAnalysisJob({
                type: database_1.JobType.NOVEL_ANALYSIS,
                payload: {
                    projectId,
                    novelSourceId: novelSource.id,
                    taskId: task.id,
                    traceId,
                    title,
                    author,
                    chapterCount: parsed.chapterCount,
                },
            }, user.userId, organizationId, task.id, undefined, request.ip || request.headers['x-forwarded-for'], request.headers['user-agent']);
            await this.prisma.novelAnalysisJob.update({
                where: { id: analysisJob.id },
                data: {
                    progress: { message: 'Job created', jobId: job.id, taskId: task.id },
                },
            });
            const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
            this.auditLogService
                .record({
                userId: user.userId,
                action: 'NOVEL_IMPORT_FILE',
                resourceType: 'project',
                resourceId: projectId,
                ip: requestInfo.ip,
                userAgent: requestInfo.userAgent,
                details: { novelSourceId: novelSource.id, title, characterCount: parsed.characterCount },
            })
                .catch((e) => this.logger.error('Audit fail', e));
            return {
                success: true,
                data: {
                    jobId: job.id,
                    analysisJobId: analysisJob.id,
                    novelSourceId: novelSource.id,
                    title,
                    author,
                    characterCount: parsed.characterCount,
                    chapterCount: parsed.chapterCount,
                },
                message: 'Novel imported, analysis job created',
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            if (filePath)
                await fs.unlink(filePath).catch(() => { });
            if (error instanceof common_2.UnprocessableEntityException)
                throw error;
            throw new common_1.BadRequestException(error.message || 'Import failed');
        }
    }
    async importNovel(projectId, importNovelDto, user, organizationId, request) {
        if (!organizationId)
            throw new common_1.ForbiddenException('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const rawText = importNovelDto.rawText || importNovelDto.content || '';
        if (!rawText)
            throw new common_1.BadRequestException('小说内容不能为空');
        const traceId = (0, crypto_1.randomUUID)();
        const title = importNovelDto.title || 'Direct Import ' + new Date().toISOString();
        if (rawText.length > this.SHREDDER_THRESHOLD_CHARACTERS) {
            this.logger.log(`[Stage 4] Large text import detected (${rawText.length} chars), offloading to Shredder.`);
            const tempFileName = `direct-import-${Date.now()}.txt`;
            const tempPath = path.join(this.uploadDir, tempFileName);
            await fs.writeFile(tempPath, rawText);
            const novelSource = await this.prisma.novel.create({
                data: {
                    projectId,
                    organizationId,
                    title,
                    author: importNovelDto.author || 'Unknown',
                    status: 'PARSING',
                    metadata: { importType: 'TEXT', traceId, originalFileName: tempFileName },
                },
            });
            const result = await this.novelImportService.triggerShredderWorkflow(novelSource.id, projectId, organizationId, user.userId, tempPath, tempFileName, traceId);
            return {
                success: true,
                data: {
                    jobId: result.jobId,
                    taskId: result.taskId,
                    novelSourceId: result.novelSourceId,
                    mode: 'SHREDDER',
                },
                message: 'Massive text detected, Shredder scanning started',
            };
        }
        await this.performSafetyCheck(rawText, {
            projectId,
            userId: user.userId,
            organizationId,
            traceId,
        });
        const novelSource = await this.prisma.novel.create({
            data: {
                projectId,
                organizationId,
                title,
                author: importNovelDto.author || 'Unknown',
                characterCount: rawText.length,
                status: 'PARSING',
            },
        });
        const volume = await this.prisma.novelVolume.create({
            data: { projectId, novelSourceId: novelSource.id, index: 1, title: '默认卷' },
        });
        const chapters = this.fileParserService.parseChaptersFromText(rawText);
        const savedChapterIds = [];
        for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            const savedChapter = await this.prisma.novelChapter.create({
                data: {
                    novelSourceId: novelSource.id,
                    volumeId: volume.id,
                    index: i + 1,
                    title: ch.title,
                    rawContent: ch.content,
                },
            });
            await this.prisma.scene.create({
                data: { chapterId: savedChapter.id, projectId, sceneIndex: 1, title: 'Scene 1' },
            });
            savedChapterIds.push(savedChapter.id);
        }
        const task = await this.taskService.create({
            organizationId,
            projectId,
            type: 'NOVEL_ANALYSIS',
            status: 'PENDING',
            traceId,
        });
        const job = await this.jobService.createNovelAnalysisJob({
            type: database_1.JobType.NOVEL_ANALYSIS,
            payload: {
                projectId,
                novelSourceId: novelSource.id,
                taskId: task.id,
                traceId,
                title,
                chapterCount: chapters.length,
            },
        }, user.userId, organizationId, task.id, undefined, request.ip || request.headers['x-forwarded-for'], request.headers['user-agent']);
        return {
            success: true,
            data: {
                jobId: job.id,
                taskId: task.id,
                novelSourceId: novelSource.id,
                chapterCount: chapters.length,
            },
            message: 'Novel imported, analysis job created',
        };
    }
    async getAnalysisJobs(projectId, user, organizationId) {
        if (!organizationId)
            throw new common_1.ForbiddenException('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const jobs = await this.prisma.novelAnalysisJob.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return {
            success: true,
            data: { jobs },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getStatus(projectId, user, organizationId) {
        if (!organizationId)
            throw new common_1.ForbiddenException('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const novelSource = await this.prisma.novelSource.findUnique({
            where: { projectId },
        });
        if (!novelSource) {
            throw new common_1.NotFoundException('找不到小说源或尚未开始分片导入');
        }
        return {
            success: true,
            data: {
                id: novelSource.id,
                status: novelSource.status,
                totalChapters: novelSource.totalChapters,
                processedChunks: novelSource.processedChunks,
                progress: novelSource.totalChapters > 0
                    ? novelSource.processedChunks / novelSource.totalChapters
                    : 0,
                error: novelSource.error,
                updatedAt: novelSource.updatedAt,
            },
        };
    }
    async analyzeNovel(projectId, body, user, organizationId, request) {
        if (!organizationId)
            throw new common_1.ForbiddenException('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const novelSource = await this.prisma.novel.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
        if (!novelSource)
            throw new common_1.NotFoundException('找不到小说源');
        const task = await this.taskService.create({
            organizationId,
            projectId,
            type: 'NOVEL_ANALYSIS',
            status: 'PENDING',
        });
        const job = await this.jobService.createNovelAnalysisJob({
            type: database_1.JobType.NOVEL_ANALYSIS,
            payload: {
                projectId,
                novelSourceId: novelSource.id,
                chapterId: body.chapterId,
                organizationId,
                userId: user.userId,
            },
        }, user.userId, organizationId, task.id, undefined, request.ip || request.headers['x-forwarded-for'], request.headers['user-agent']);
        return {
            success: true,
            data: { jobId: job.id, taskId: task.id },
            message: 'Analysis started',
        };
    }
};
exports.NovelImportController = NovelImportController;
__decorate([
    (0, common_1.Post)('import-file'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadDir = path.join(process.cwd(), 'uploads', 'novels');
                fs.mkdir(uploadDir, { recursive: true })
                    .then(() => cb(null, uploadDir))
                    .catch((err) => cb(err, uploadDir));
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const ext = path.extname(file.originalname);
                cb(null, `${uniqueSuffix}${ext}`);
            },
        }),
        limits: {
            fileSize: 50 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            const allowedExtensions = ['.txt', '.docx', '.epub', '.md'];
            const ext = path.extname(file.originalname).toLowerCase();
            if (allowedExtensions.includes(ext)) {
                cb(null, true);
            }
            else {
                cb(new common_1.BadRequestException(`File type ${ext} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`), false);
            }
        },
    })),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_WRITE),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_UPDATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, import_novel_file_dto_1.ImportNovelFileDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], NovelImportController.prototype, "importNovelFile", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, import_novel_dto_1.ImportNovelDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], NovelImportController.prototype, "importNovel", null);
__decorate([
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], NovelImportController.prototype, "getAnalysisJobs", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], NovelImportController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('analyze'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_GENERATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], NovelImportController.prototype, "analyzeNovel", null);
exports.NovelImportController = NovelImportController = NovelImportController_1 = __decorate([
    (0, common_1.Controller)('projects/:projectId/novel'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __param(0, (0, common_1.Inject)(novel_import_service_1.NovelImportService)),
    __param(1, (0, common_1.Inject)(file_parser_service_1.FileParserService)),
    __param(2, (0, common_1.Inject)(novel_analysis_processor_service_1.NovelAnalysisProcessorService)),
    __param(3, (0, common_1.Inject)(project_service_1.ProjectService)),
    __param(4, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(5, (0, common_1.Inject)(task_service_1.TaskService)),
    __param(6, (0, common_1.Inject)(engine_task_service_1.EngineTaskService)),
    __param(7, (0, common_1.Inject)(job_service_1.JobService)),
    __param(8, (0, common_1.Inject)(structure_generate_service_1.StructureGenerateService)),
    __param(9, (0, common_1.Inject)(scene_graph_service_1.SceneGraphService)),
    __param(10, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(11, (0, common_1.Inject)(feature_flag_service_1.FeatureFlagService)),
    __param(12, (0, common_1.Inject)(text_safety_service_1.TextSafetyService)),
    __metadata("design:paramtypes", [novel_import_service_1.NovelImportService,
        file_parser_service_1.FileParserService,
        novel_analysis_processor_service_1.NovelAnalysisProcessorService,
        project_service_1.ProjectService,
        prisma_service_1.PrismaService,
        task_service_1.TaskService,
        engine_task_service_1.EngineTaskService,
        job_service_1.JobService,
        structure_generate_service_1.StructureGenerateService,
        scene_graph_service_1.SceneGraphService,
        audit_log_service_1.AuditLogService,
        feature_flag_service_1.FeatureFlagService,
        text_safety_service_1.TextSafetyService])
], NovelImportController);
//# sourceMappingURL=novel-import.controller.js.map