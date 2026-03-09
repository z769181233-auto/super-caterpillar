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
var JobReportFacade_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobReportFacade = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("./job.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const director_solver_service_1 = require("../shot-director/director-solver.service");
const cost_ledger_service_1 = require("../cost/cost-ledger.service");
let JobReportFacade = JobReportFacade_1 = class JobReportFacade {
    jobService;
    prisma;
    directorSolver;
    costLedger;
    logger = new common_1.Logger(JobReportFacade_1.name);
    constructor(jobService, prisma, directorSolver, costLedger) {
        this.jobService = jobService;
        this.prisma = prisma;
        this.directorSolver = directorSolver;
        this.costLedger = costLedger;
    }
    normalizeStorageKey(key) {
        if (!key)
            return key;
        if (key.includes('apps/workers/.runtime/') || key.includes('.runtime/')) {
            const assetsIdx = key.lastIndexOf('assets/');
            const videosIdx = key.lastIndexOf('videos/');
            const startIdx = Math.max(assetsIdx, videosIdx);
            if (startIdx !== -1) {
                const normalized = key.substring(startIdx);
                this.logger.log(`[NormalizeKey] Stripped pollution: "${key}" -> "${normalized}"`);
                return normalized;
            }
            else {
                throw new Error(`[NormalizeKey] REJECT: No assets/ or videos/ found in key: ${key}`);
            }
        }
        if (key.startsWith('/')) {
            const assetsIdx = key.lastIndexOf('assets/');
            const videosIdx = key.lastIndexOf('videos/');
            const startIdx = Math.max(assetsIdx, videosIdx);
            if (startIdx !== -1) {
                const normalized = key.substring(startIdx);
                this.logger.log(`[NormalizeKey] Stripped absolute path: "${key}" -> "${normalized}"`);
                return normalized;
            }
            else {
                throw new Error(`[NormalizeKey] REJECT: Absolute path without assets/ or videos/: ${key}`);
            }
        }
        return key;
    }
    async handleReport(params) {
        const updatedJob = await this.jobService.reportJobResult(params.jobId, params.status, params.result, params.errorMessage, params.userId, params.apiKeyId, params.ip, params.userAgent, params.hmacMeta, params.attempts);
        if (updatedJob &&
            (updatedJob.type === database_1.JobType.CE03_VISUAL_DENSITY ||
                updatedJob.type === database_1.JobType.CE04_VISUAL_ENRICHMENT) &&
            updatedJob.status === database_1.JobStatus.SUCCEEDED) {
            try {
                const job = await this.prisma.shotJob.findUnique({
                    where: { id: params.jobId },
                    select: {
                        id: true,
                        type: true,
                        projectId: true,
                        traceId: true,
                        payload: true,
                    },
                });
                if (job) {
                    this.logger.log(`[REPORT_FACADE] CE03/CE04 Auto-Quality skipped (DECOUPLED): jobId=${job.id}`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to write QualityMetrics for job ${params.jobId}: ${error.message}`, error.stack);
            }
        }
        if (updatedJob && updatedJob.type === database_1.JobType.CE04_VISUAL_ENRICHMENT) {
            try {
                const payload = updatedJob.payload ?? {};
                const shotId = payload.shotId ?? updatedJob.shotId;
                if (!shotId) {
                    this.logger.warn(`[CE05] skip: missing shotId jobId=${updatedJob.id}`);
                }
                else {
                    const shotInput = {
                        id: shotId,
                        type: payload.type ?? 'DEFAULT',
                        params: {
                            durationSec: payload.durationSec ?? 5,
                            prompt: payload.prompt ?? '',
                            motion: payload.motion ?? 'NONE',
                        },
                    };
                    const validation = this.directorSolver.validateShot(shotInput);
                    await this.prisma.shotPlanning.upsert({
                        where: { shotId },
                        create: {
                            shotId,
                            engineKey: 'CE05_DIRECTOR',
                            engineVersion: null,
                            confidence: validation.violations.length === 0 ? 1.0 : 0.5,
                            data: JSON.parse(JSON.stringify(validation)),
                        },
                        update: {
                            engineKey: 'CE05_DIRECTOR',
                            confidence: validation.violations.length === 0 ? 1.0 : 0.5,
                            data: JSON.parse(JSON.stringify(validation)),
                        },
                    });
                    this.logger.log(`[CE05] ShotPlanning upserted shotId=${shotId} isValid=${validation.isValid} violations=${validation.violations.length}`);
                }
            }
            catch (e) {
                this.logger.warn(`[CE05] failed (non-blocking) jobId=${updatedJob.id} err=${e?.message ?? e}`);
            }
        }
        if (updatedJob &&
            updatedJob.type === database_1.JobType.CE01_REFERENCE_SHEET &&
            updatedJob.status === database_1.JobStatus.SUCCEEDED) {
            try {
                const assetKeys = params.result?.assets || params.result?.assetKeys || [];
                const characterId = updatedJob.payload?.characterId;
                const fingerprint = updatedJob.payload?.fingerprint;
                if (assetKeys.length > 0) {
                    const binding = await this.prisma.jobEngineBinding.findFirst({
                        where: {
                            jobId: updatedJob.id,
                            engineKey: 'character_visual',
                        },
                    });
                    if (!binding) {
                        this.logger.warn(`[CE01] No binding found for job ${updatedJob.id}, skipping asset binding`);
                    }
                    else {
                        const oldMetadata = binding.metadata || {};
                        const nextMetadata = {
                            ...oldMetadata,
                            characterId,
                            fingerprint,
                            artifacts: assetKeys,
                            completedAt: new Date().toISOString(),
                        };
                        await this.prisma.jobEngineBinding.update({
                            where: { id: binding.id },
                            data: { metadata: nextMetadata },
                        });
                        this.logger.log(`[CE01] Merged metadata for binding ${binding.id}, artifacts: ${assetKeys.length}`);
                    }
                }
            }
            catch (e) {
                this.logger.error(`[CE01] Failed to update JobEngineBinding metadata: ${e.message}`, e.stack);
            }
        }
        if (updatedJob && updatedJob.status === database_1.JobStatus.SUCCEEDED) {
            try {
                if (updatedJob.type === database_1.JobType.SHOT_RENDER && updatedJob.shotId) {
                    const rawFrameKeys = params.result?.frameKeys || params.result?.assets || [];
                    const frameKeys = rawFrameKeys.map((key) => this.normalizeStorageKey(key));
                    if (frameKeys.length > 0) {
                        await this.jobService.ensureVideoRenderJob(updatedJob.shotId, frameKeys, updatedJob.traceId || `trace-${updatedJob.id}`, params.userId || 'system', updatedJob.organizationId, updatedJob.isVerification || false);
                        this.logger.log(`[JobReportFacade] Triggered VIDEO_RENDER for Shot ${updatedJob.shotId}, isVerification=${updatedJob.isVerification}`);
                    }
                }
                if (updatedJob.type === database_1.JobType.VIDEO_RENDER && updatedJob.shotId) {
                    const videoUrl = params.result?.outputKey || params.result?.storageKey || params.result?.videoUrl;
                    if (videoUrl) {
                        await this.prisma.asset.upsert({
                            where: {
                                ownerType_ownerId_type: {
                                    ownerType: 'SHOT',
                                    ownerId: updatedJob.shotId,
                                    type: 'VIDEO',
                                },
                            },
                            create: {
                                projectId: updatedJob.projectId,
                                ownerType: 'SHOT',
                                ownerId: updatedJob.shotId,
                                type: 'VIDEO',
                                status: 'GENERATED',
                                storageKey: videoUrl,
                                createdByJobId: updatedJob.id,
                            },
                            update: {
                                storageKey: videoUrl,
                                status: 'GENERATED',
                                createdByJobId: updatedJob.id,
                            },
                        });
                        this.logger.log(`[JobReportFacade] Created Video Asset for Shot ${updatedJob.shotId}`);
                    }
                    else {
                        this.logger.warn(`[JobReportFacade] VIDEO_RENDER succeeded but no videoUrl/storageKey found in result.`);
                    }
                }
            }
            catch (e) {
                this.logger.error(`[JobReportFacade] Failed to handle Job Success Side-effects: ${e.message}`, e.stack);
            }
        }
        if (updatedJob &&
            updatedJob.type === database_1.JobType.TIMELINE_PREVIEW &&
            updatedJob.status === database_1.JobStatus.SUCCEEDED) {
            try {
                const metrics = params.result?.metrics || {};
                const costAmount = metrics.cost || 0.05;
                const project = await this.prisma.project.findUnique({
                    where: { id: updatedJob.projectId },
                    select: { ownerId: true },
                });
                await this.costLedger.recordFromEvent({
                    userId: project?.ownerId || params.userId || 'system',
                    projectId: updatedJob.projectId,
                    jobId: updatedJob.id,
                    jobType: updatedJob.type,
                    engineKey: 'ce11',
                    costAmount,
                    billingUnit: 'job',
                    quantity: 1,
                    metadata: metrics,
                });
            }
            catch (e) {
                this.logger.error(`[Billing] Failed to record CE11 cost for job ${updatedJob.id}: ${e.message}`);
            }
        }
        return updatedJob;
    }
};
exports.JobReportFacade = JobReportFacade;
exports.JobReportFacade = JobReportFacade = JobReportFacade_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(job_service_1.JobService)),
    __param(1, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(2, (0, common_1.Inject)(director_solver_service_1.DirectorConstraintSolverService)),
    __param(3, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [job_service_1.JobService,
        prisma_service_1.PrismaService,
        director_solver_service_1.DirectorConstraintSolverService,
        cost_ledger_service_1.CostLedgerService])
], JobReportFacade);
//# sourceMappingURL=job-report.facade.js.map