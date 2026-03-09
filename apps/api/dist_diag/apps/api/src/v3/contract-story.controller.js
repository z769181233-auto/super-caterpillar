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
var ContractStoryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractStoryController = void 0;
const common_1 = require("@nestjs/common");
const story_service_1 = require("../story/story.service");
const prisma_service_1 = require("../prisma/prisma.service");
const asset_receipt_resolver_service_1 = require("./asset-receipt-resolver.service");
let ContractStoryController = ContractStoryController_1 = class ContractStoryController {
    storyService;
    prisma;
    assetResolver;
    logger = new common_1.Logger(ContractStoryController_1.name);
    constructor(storyService, prisma, assetResolver) {
        this.storyService = storyService;
        this.prisma = prisma;
        this.assetResolver = assetResolver;
    }
    async parseStory(body) {
        this.logger.log(`[V3] parseStory called for project ${body.project_id}, is_verification=${body.is_verification}`);
        const project = await this.prisma.project.findUnique({ where: { id: body.project_id } });
        if (!project) {
            this.logger.warn(`[V3] Project not found: ${body.project_id}`);
            throw new common_1.NotFoundException('Project not found');
        }
        try {
            const customTraceId = body.trace_id || body.traceId;
            const result = await this.storyService.parseStory({
                projectId: body.project_id,
                rawText: body.raw_text || '',
                title: body.title,
                author: body.author,
            }, project.ownerId, body.organization_id || project.organizationId, '127.0.0.1', 'v3-api-client', customTraceId, body.is_verification);
            return {
                job_id: result.jobId,
                status: 'QUEUED',
                note: 'Async job started',
                trace_id: result.traceId,
            };
        }
        catch (e) {
            this.logger.error(`[V3] parseStory failed: ${e.message}`, e.stack);
            throw new common_1.InternalServerErrorException(e.message);
        }
    }
    async getJob(jobId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: {
                project: true,
                generatedAsset: true,
                task: true,
            },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        const taskPayload = job.task?.payload;
        const isShredder = taskPayload?.mode === 'SHREDDER';
        let totalChunks = 0;
        let succeededChunks = 0;
        let failedChunks = 0;
        let runningChunks = 0;
        let totalShotJobs = 0;
        let succeededShotJobs = 0;
        let failedShotJobs = 0;
        if (isShredder) {
            const chunkStats = await this.prisma.shotJob.groupBy({
                by: ['status'],
                where: {
                    taskId: job.taskId,
                    type: 'NOVEL_CHUNK_PARSE',
                },
                _count: true,
            });
            for (const stat of chunkStats) {
                const count = stat._count;
                totalChunks += count;
                if (stat.status === 'SUCCEEDED')
                    succeededChunks += count;
                if (stat.status === 'FAILED')
                    failedChunks += count;
                if (stat.status === 'RUNNING')
                    runningChunks += count;
            }
            const shotGenStats = await this.prisma.shotJob.groupBy({
                by: ['status'],
                where: {
                    taskId: job.taskId,
                    type: 'CE11_SHOT_GENERATOR',
                },
                _count: true,
            });
            for (const stat of shotGenStats) {
                const count = stat._count;
                totalShotJobs += count;
                if (stat.status === 'SUCCEEDED')
                    succeededShotJobs += count;
                if (stat.status === 'FAILED')
                    failedShotJobs += count;
            }
        }
        let v3Status = 'QUEUED';
        const status = job.status;
        if (isShredder) {
            const chunksDone = totalChunks > 0 && succeededChunks === totalChunks;
            const shotsDone = totalShotJobs > 0 && succeededShotJobs === totalShotJobs;
            const shotsEmpty = totalShotJobs === 0;
            if (job.status === 'FAILED' || failedChunks > 0 || failedShotJobs > 0) {
                v3Status = 'FAILED';
            }
            else if (chunksDone && (shotsDone || shotsEmpty)) {
                if (job.status === 'SUCCEEDED')
                    v3Status = 'SUCCEEDED';
                else
                    v3Status = 'RUNNING';
            }
            else {
                v3Status = 'RUNNING';
            }
        }
        else {
            if (['RUNNING', 'PROCESSING', 'EXECUTING'].includes(status))
                v3Status = 'RUNNING';
            if (['SUCCEEDED', 'COMPLETED'].includes(status))
                v3Status = 'SUCCEEDED';
            if (status === 'FAILED')
                v3Status = 'FAILED';
        }
        const jobType = job.type;
        let currentStep = 'CE06_PARSING';
        let progress = 0;
        if (isShredder) {
            if (job.status === 'PENDING' || job.status === 'RUNNING') {
                currentStep = 'CE06_SCAN';
                progress = 5;
                if (totalChunks > 0) {
                    currentStep = 'CE06_PARSING';
                    progress = 5 + Math.floor((succeededChunks / totalChunks) * 45);
                }
            }
            else {
                if (succeededChunks < totalChunks) {
                    currentStep = 'CE06_PARSING';
                    progress = 5 + Math.floor((succeededChunks / totalChunks) * 45);
                }
                else {
                    if (totalShotJobs > 0) {
                        const shotProgress = succeededShotJobs / totalShotJobs;
                        if (shotProgress < 1) {
                            currentStep = 'CE11_PLANNING';
                            progress = 50 + Math.floor(shotProgress * 45);
                        }
                        else {
                            currentStep = 'CE11_PLANNING';
                            progress = 95;
                        }
                    }
                    else {
                        progress = 90;
                    }
                }
            }
            if (v3Status === 'SUCCEEDED') {
                progress = 100;
                currentStep = 'Done';
            }
        }
        else {
            if (v3Status === 'RUNNING')
                progress = 50;
            if (v3Status === 'SUCCEEDED')
                progress = 100;
            if (jobType === 'NOVEL_SCAN_TOC')
                currentStep = 'CE06_SCAN';
            if (jobType === 'NOVEL_CHUNK_PARSE' || jobType === 'CE06_NOVEL_PARSING')
                currentStep = 'CE06_PARSING';
            if (jobType === 'CE11_SHOT_GENERATOR')
                currentStep = 'CE11_SHOT_GEN';
            if (jobType === 'SHOT_RENDER')
                currentStep = 'SHOT_RENDER';
            if (jobType === 'VIDEO_RENDER')
                currentStep = 'VIDEO_MERGE';
        }
        const scenesCount = await this.prisma.scene.count({ where: { projectId: job.projectId } });
        const shotsCount = await this.prisma.shot.count({
            where: {
                scene: {
                    projectId: job.projectId,
                },
            },
        });
        let resultPreview = null;
        if (v3Status === 'SUCCEEDED') {
            const assetReceipt = await this.assetResolver.resolveAsset({
                projectId: job.projectId,
                traceId: job.traceId || '',
                jobId: job.id,
                jobCreatedAt: job.createdAt,
            });
            resultPreview = {
                ...assetReceipt,
                scenes_count: scenesCount,
                shots_count: shotsCount,
                cost_ledger_count: 1,
            };
        }
        else {
            resultPreview = {
                asset_id: null,
                hls_url: null,
                mp4_url: null,
                checksum: null,
                storage_key: null,
                duration_sec: null,
                fallback_reason: null,
                scenes_count: scenesCount,
                shots_count: shotsCount,
                cost_ledger_count: 0,
                error_code: v3Status === 'FAILED' ? 'JOB_FAILED' : undefined,
            };
        }
        return {
            id: job.id,
            status: v3Status,
            progress: progress,
            current_step: currentStep,
            result_preview: resultPreview,
            error: job.status === 'FAILED' ? { code: 'JOB_FAILED', message: job.lastError } : null,
            created_at: job.createdAt,
            updated_at: job.updatedAt,
        };
    }
};
exports.ContractStoryController = ContractStoryController;
__decorate([
    (0, common_1.Post)('parse'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContractStoryController.prototype, "parseStory", null);
__decorate([
    (0, common_1.Get)('job/:job_id'),
    __param(0, (0, common_1.Param)('job_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractStoryController.prototype, "getJob", null);
exports.ContractStoryController = ContractStoryController = ContractStoryController_1 = __decorate([
    (0, common_1.Controller)('v3/story'),
    __metadata("design:paramtypes", [story_service_1.StoryService,
        prisma_service_1.PrismaService,
        asset_receipt_resolver_service_1.AssetReceiptResolverService])
], ContractStoryController);
//# sourceMappingURL=contract-story.controller.js.map