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
var QualityBackfillSweeper_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityBackfillSweeper = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const quality_score_service_1 = require("./quality-score.service");
const feature_flag_service_1 = require("../feature-flag/feature-flag.service");
const database_1 = require("database");
let QualityBackfillSweeper = QualityBackfillSweeper_1 = class QualityBackfillSweeper {
    prisma;
    qualityScoreService;
    featureFlagService;
    logger = new common_1.Logger(QualityBackfillSweeper_1.name);
    constructor(prisma, qualityScoreService, featureFlagService) {
        this.prisma = prisma;
        this.qualityScoreService = qualityScoreService;
        this.featureFlagService = featureFlagService;
    }
    async backfillQualityScores() {
        const now = new Date();
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
        try {
            const successfulJobs = await this.prisma.shotJob.findMany({
                where: {
                    type: database_1.JobType.SHOT_RENDER,
                    status: database_1.JobStatus.SUCCEEDED,
                    updatedAt: { gte: fifteenMinsAgo },
                },
                select: {
                    id: true,
                    shotId: true,
                    traceId: true,
                    attempts: true,
                    organizationId: true,
                    projectId: true,
                },
                take: 200,
            });
            if (successfulJobs.length === 0) {
                return;
            }
            this.logger.debug(`[QualitySweeper] Scanning ${successfulJobs.length} successful jobs for backfill...`);
            let backfilledCount = 0;
            for (const job of successfulJobs) {
                if (!job.shotId) {
                    this.logger.warn(`[QualitySweeper] Job ${job.id} missing shotId, skipping.`);
                    continue;
                }
                const isEnabled = await this.featureFlagService.isAutoReworkEnabled({
                    orgId: job.organizationId || undefined,
                    projectId: job.projectId || undefined,
                });
                if (!isEnabled)
                    continue;
                const existingScore = await this.prisma.qualityScore.findFirst({
                    where: {
                        shotId: job.shotId,
                        attempt: job.attempts || 1,
                    },
                });
                if (!existingScore) {
                    try {
                        this.logger.log(`[QualitySweeper] Backfilling missing score for shot=${job.shotId} (traceId=${job.traceId || 'N/A'})`);
                        await this.qualityScoreService.performScoring(job.shotId, job.traceId || '', job.attempts || 1);
                        backfilledCount++;
                    }
                    catch (e) {
                        this.logger.error(`[QualitySweeper] Failed to backfill for shot ${job.shotId}: ${e.message}`);
                    }
                }
            }
            if (backfilledCount > 0) {
                this.logger.log(`[QualitySweeper] Successfully backfilled ${backfilledCount} quality scores.`);
            }
        }
        catch (error) {
            this.logger.error(`[QualitySweeper] Error during backfill scan: ${error.message}`);
        }
    }
};
exports.QualityBackfillSweeper = QualityBackfillSweeper;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QualityBackfillSweeper.prototype, "backfillQualityScores", null);
exports.QualityBackfillSweeper = QualityBackfillSweeper = QualityBackfillSweeper_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quality_score_service_1.QualityScoreService,
        feature_flag_service_1.FeatureFlagService])
], QualityBackfillSweeper);
//# sourceMappingURL=quality-backfill.sweeper.js.map