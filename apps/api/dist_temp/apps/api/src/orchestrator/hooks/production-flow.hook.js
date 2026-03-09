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
var ProductionFlowHook_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionFlowHook = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const job_service_1 = require("../../job/job.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const database_1 = require("database");
let ProductionFlowHook = ProductionFlowHook_1 = class ProductionFlowHook {
    jobService;
    prisma;
    logger = new common_1.Logger(ProductionFlowHook_1.name);
    constructor(jobService, prisma) {
        this.jobService = jobService;
        this.prisma = prisma;
    }
    async handleJobSucceeded(evt) {
        if (evt.type === 'SHOT_RENDER') {
            await this.handleShotRenderSuccess(evt);
        }
        else if (evt.type === 'PIPELINE_TIMELINE_COMPOSE') {
            await this.handleTimelineComposeSuccess(evt);
        }
        else if (evt.type === 'TIMELINE_RENDER') {
            await this.handleTimelineRenderSuccess(evt);
        }
    }
    async handleShotRenderSuccess(evt) {
        const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
        if (!job)
            return;
        const payload = job.payload;
        const pipelineRunId = payload.pipelineRunId || payload.runId;
        const sceneId = job.sceneId;
        if (!pipelineRunId || !sceneId)
            return;
        const totalShots = await this.prisma.shot.count({ where: { sceneId } });
        const finishedJobs = await this.prisma.shotJob.count({
            where: {
                type: 'SHOT_RENDER',
                status: 'SUCCEEDED',
                sceneId,
                payload: {
                    path: ['pipelineRunId'],
                    equals: pipelineRunId,
                },
            },
        });
        this.logger.log(`[ProductionFlow] [${pipelineRunId}] Scene ${sceneId}: ${finishedJobs}/${totalShots} shots rendered.`);
        if (finishedJobs >= totalShots) {
            const dedupeKey = `compose_${pipelineRunId}_${sceneId}`;
            try {
                await this.jobService.createCECoreJob({
                    projectId: job.projectId,
                    organizationId: job.organizationId,
                    jobType: database_1.JobType.PIPELINE_TIMELINE_COMPOSE,
                    payload: {
                        sceneId,
                        pipelineRunId,
                        projectId: job.projectId,
                    },
                    traceId: job.traceId ?? undefined,
                    dedupeKey,
                });
                this.logger.log(`[ProductionFlow] Triggered TIMELINE_COMPOSE for ${dedupeKey}`);
            }
            catch (e) {
                if (!e.message.includes('Unique constraint')) {
                    this.logger.error(`[ProductionFlow] Failed to trigger Compose: ${e.message}`);
                }
            }
        }
    }
    async handleTimelineComposeSuccess(evt) {
        const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
        if (!job)
            return;
        const payload = job.payload;
        const pipelineRunId = payload.pipelineRunId;
        const sceneId = payload.sceneId;
        const timelineStorageKey = job.result?.output?.timelineStorageKey;
        if (!pipelineRunId || !timelineStorageKey)
            return;
        const dedupeKey = `render_${pipelineRunId}_${sceneId}`;
        try {
            await this.jobService.createCECoreJob({
                projectId: job.projectId,
                organizationId: job.organizationId,
                jobType: database_1.JobType.TIMELINE_RENDER,
                payload: {
                    sceneId,
                    pipelineRunId,
                    timelineStorageKey,
                    projectId: job.projectId,
                    publish: true,
                },
                traceId: job.traceId ?? undefined,
                dedupeKey,
            });
            this.logger.log(`[ProductionFlow] Triggered TIMELINE_RENDER for ${dedupeKey}`);
        }
        catch (e) {
        }
    }
    async handleTimelineRenderSuccess(evt) {
        const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
        if (!job)
            return;
        const payload = job.payload;
        if (payload.publish) {
            const assetId = job.result?.assetId;
            const storageKey = job.result?.storageKey;
            if (assetId && storageKey) {
                const project = await this.prisma.project.findUnique({ where: { id: job.projectId } });
                const scene = await this.prisma.scene.findUnique({
                    where: { id: payload.sceneId },
                    include: { episode: true },
                });
                const episodeId = scene?.episodeId;
                if (episodeId) {
                    const dedupeKey = `pub_${payload.pipelineRunId}`;
                    await this.prisma.publishedVideo.upsert({
                        where: { assetId },
                        create: {
                            projectId: job.projectId,
                            episodeId,
                            assetId,
                            storageKey,
                            checksum: 'auto-generated',
                            status: 'PUBLISHED',
                            metadata: {
                                pipelineRunId: payload.pipelineRunId,
                                source: 'ProductionFlowHook',
                                dedupeKey,
                            },
                        },
                        update: {
                            storageKey,
                            status: 'PUBLISHED',
                            updatedAt: new Date(),
                        },
                    });
                    this.logger.log(`[ProductionFlow] Created PublishedVideo for assetId=${assetId}, pipelineRunId=${payload.pipelineRunId}`);
                }
            }
        }
    }
};
exports.ProductionFlowHook = ProductionFlowHook;
__decorate([
    (0, event_emitter_1.OnEvent)('job.succeeded'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductionFlowHook.prototype, "handleJobSucceeded", null);
exports.ProductionFlowHook = ProductionFlowHook = ProductionFlowHook_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService])
], ProductionFlowHook);
//# sourceMappingURL=production-flow.hook.js.map