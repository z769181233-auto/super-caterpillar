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
var ContractShotController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractShotController = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("../job/job.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const asset_receipt_resolver_service_1 = require("./asset-receipt-resolver.service");
let ContractShotController = ContractShotController_1 = class ContractShotController {
    jobService;
    prisma;
    assetResolver;
    logger = new common_1.Logger(ContractShotController_1.name);
    constructor(jobService, prisma, assetResolver) {
        this.jobService = jobService;
        this.prisma = prisma;
        this.assetResolver = assetResolver;
    }
    async batchGenerate(body) {
        this.logger.log(`[V3] batchGenerate called for scene ${body.scene_id}`);
        const scene = await this.prisma.scene.findUnique({
            where: { id: body.scene_id },
        });
        if (!scene)
            throw new common_1.NotFoundException('Scene not found');
        const projectId = body.project_id || scene.projectId;
        if (!projectId)
            throw new common_1.NotFoundException('Project context missing');
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const orgId = body.organization_id || project.organizationId;
        const traceId = `v3_bg_${scene.id}_${Date.now()}`;
        const job = await this.jobService.createCECoreJob({
            projectId: project.id,
            organizationId: orgId,
            jobType: database_1.JobType.CE11_SHOT_GENERATOR,
            payload: {
                sceneId: scene.id,
                novelSceneId: scene.id,
                engineKey: 'ce11_shot_generator_mock',
                traceId,
            },
            traceId,
        });
        return {
            job_id: job.id,
            status: 'QUEUED',
            trace_id: job.traceId || traceId,
        };
    }
    async renderShot(id) {
        const shot = await this.prisma.shot.findUnique({ where: { id } });
        if (!shot)
            throw new common_1.NotFoundException('Shot not found');
        return {
            id: shot.id,
            render_status: 'PENDING',
        };
    }
    async getJob(jobId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: {
                project: true,
                generatedAsset: true,
            },
        });
        if (!job) {
            throw new common_1.NotFoundException('Job not found');
        }
        let v3Status = 'QUEUED';
        const status = job.status;
        if (['RUNNING', 'PROCESSING', 'EXECUTING'].includes(status))
            v3Status = 'RUNNING';
        if (['SUCCEEDED', 'COMPLETED'].includes(status))
            v3Status = 'SUCCEEDED';
        if (status === 'FAILED')
            v3Status = 'FAILED';
        const jobType = job.type;
        let currentStep = 'CE11_SHOT_GEN';
        let progress = 0;
        if (v3Status === 'RUNNING')
            progress = 50;
        if (v3Status === 'SUCCEEDED')
            progress = 100;
        if (jobType === 'CE11_SHOT_GENERATOR')
            currentStep = 'CE11_SHOT_GEN';
        if (jobType === 'SHOT_RENDER')
            currentStep = 'SHOT_RENDER';
        if (jobType === 'VIDEO_RENDER')
            currentStep = 'VIDEO_MERGE';
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
exports.ContractShotController = ContractShotController;
__decorate([
    (0, common_1.Post)('batch-generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContractShotController.prototype, "batchGenerate", null);
__decorate([
    (0, common_1.Post)(':id/render'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractShotController.prototype, "renderShot", null);
__decorate([
    (0, common_1.Get)('job/:job_id'),
    __param(0, (0, common_1.Param)('job_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractShotController.prototype, "getJob", null);
exports.ContractShotController = ContractShotController = ContractShotController_1 = __decorate([
    (0, common_1.Controller)('v3/shot'),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService,
        asset_receipt_resolver_service_1.AssetReceiptResolverService])
], ContractShotController);
//# sourceMappingURL=contract-shot.controller.js.map