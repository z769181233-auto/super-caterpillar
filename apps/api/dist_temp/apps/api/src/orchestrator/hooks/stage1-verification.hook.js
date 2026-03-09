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
var Stage1VerificationHook_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stage1VerificationHook = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const job_service_1 = require("../../job/job.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let Stage1VerificationHook = Stage1VerificationHook_1 = class Stage1VerificationHook {
    jobService;
    prisma;
    logger = new common_1.Logger(Stage1VerificationHook_1.name);
    constructor(jobService, prisma) {
        this.jobService = jobService;
        this.prisma = prisma;
    }
    async handleJobSucceeded(evt) {
        if (process.env.GATE_MODE !== '1' || process.env.VERIFICATION_MODE !== '1') {
            return;
        }
        if (evt.type !== 'PIPELINE_STAGE1_NOVEL_TO_VIDEO') {
            return;
        }
        const parentJob = await this.prisma.shotJob.findUnique({
            where: { id: evt.id },
            select: {
                id: true,
                projectId: true,
                organizationId: true,
                traceId: true,
                shotId: true,
                episodeId: true,
                sceneId: true,
                payload: true,
            },
        });
        if (!parentJob) {
            this.logger.error(`[VerificationHook] Parent job ${evt.id} not found in database.`);
            return;
        }
        const parentPayload = parentJob.payload || {};
        const pipelineRunId = parentPayload.pipelineRunId || parentJob.traceId;
        const episodeId = parentPayload.episodeId || parentJob.episodeId;
        const projectId = parentPayload.projectId || parentJob.projectId;
        if (!pipelineRunId) {
            this.logger.error(`[VerificationHook] Missing pipelineRunId for parentJobId=${parentJob.id}. Cannot inject Mock SHOT_RENDER.`);
            return;
        }
        this.logger.log(`[VerificationHook] PIPELINE_STAGE1 succeeded (jobId=${parentJob.id}, pipelineRunId=${pipelineRunId}). Injecting Mock SHOT_RENDER jobs.`);
        for (let i = 0; i < 3; i++) {
            const dedupeKey = `gate_shot:${parentJob.id}:${i}`;
            try {
                const existing = await this.prisma.shotJob.findUnique({
                    where: { dedupeKey },
                });
                if (existing) {
                    this.logger.log(`[VerificationHook] Mock job already exists for dedupeKey=${dedupeKey}, skipping.`);
                    continue;
                }
                await this.jobService.createCECoreJob({
                    projectId: parentJob.projectId,
                    organizationId: parentJob.organizationId,
                    jobType: 'SHOT_RENDER',
                    traceId: parentJob.traceId ?? undefined,
                    isVerification: true,
                    dedupeKey,
                    payload: {
                        pipelineRunId,
                        projectId,
                        episodeId,
                        shotId: parentJob.shotId,
                        referenceSheetId: 'gate-mock-ref-id',
                        index: i,
                        isVerification: true,
                    },
                });
                this.logger.log(`[VerificationHook] Injected Mock SHOT_RENDER ${i + 1}/3 with dedupeKey=${dedupeKey}, pipelineRunId=${pipelineRunId}`);
            }
            catch (err) {
                this.logger.error(`[VerificationHook] Failed to inject Mock SHOT_RENDER ${i}: ${err.message}`);
            }
        }
        const audioDedupeKey = `gate_audio:${parentJob.id}`;
        try {
            await this.jobService.createCECoreJob({
                projectId: parentJob.projectId,
                organizationId: parentJob.organizationId,
                jobType: 'AUDIO',
                traceId: parentJob.traceId ?? undefined,
                isVerification: true,
                dedupeKey: audioDedupeKey,
                payload: {
                    pipelineRunId,
                    projectId,
                    episodeId,
                    audioText: 'Mock Audio Content for L2 Verification',
                    isVerification: true,
                },
            });
            this.logger.log(`[VerificationHook] Injected Mock AUDIO for pipelineRunId=${pipelineRunId}`);
        }
        catch (err) {
            this.logger.error(`[VerificationHook] Failed to inject Mock AUDIO: ${err.message}`);
        }
    }
};
exports.Stage1VerificationHook = Stage1VerificationHook;
__decorate([
    (0, event_emitter_1.OnEvent)('job.succeeded'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Stage1VerificationHook.prototype, "handleJobSucceeded", null);
exports.Stage1VerificationHook = Stage1VerificationHook = Stage1VerificationHook_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService])
], Stage1VerificationHook);
//# sourceMappingURL=stage1-verification.hook.js.map