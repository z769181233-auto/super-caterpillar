import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QualityScoreService } from './quality-score.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { JobStatus, JobType } from 'database';

/**
 * QualityBackfillSweeper
 * P14-0: 质量评分补偿扫描器
 * 职责：扫描最近 15 分钟内成功但缺失 QualityScore 记录的 SHOT_RENDER，并补触发评分。
 */
@Injectable()
export class QualityBackfillSweeper {
    private readonly logger = new Logger(QualityBackfillSweeper.name);

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        private readonly qualityScoreService: QualityScoreService,
        private readonly featureFlagService: FeatureFlagService
    ) { }

    /**
     * 定期执行补偿扫描
     * 每 5 分钟扫描一次最近 15 分钟的记录
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async backfillQualityScores() {
        const now = new Date();
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

        try {
            // 1. 查找最近 15 分钟内成功的 SHOT_RENDER
            const successfulJobs = await this.prisma.shotJob.findMany({
                where: {
                    type: JobType.SHOT_RENDER,
                    status: JobStatus.SUCCEEDED,
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
                take: 200, // 批处理限制
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

                // 2. Feature Flag 校验 (Org/Project 级)
                const isEnabled = await this.featureFlagService.isAutoReworkEnabled({
                    orgId: job.organizationId || undefined,
                    projectId: job.projectId || undefined,
                });
                if (!isEnabled) continue;

                // 3. 检查是否已有评分记录 (基于 shotId + attempt)
                const existingScore = await this.prisma.qualityScore.findFirst({
                    where: {
                        shotId: job.shotId,
                        attempt: job.attempts || 1
                    },
                });

                if (!existingScore) {
                    // 4. 补齐评分与返工逻辑
                    try {
                        this.logger.log(`[QualitySweeper] Backfilling missing score for shot=${job.shotId} (traceId=${job.traceId || 'N/A'})`);

                        // 直接调用核心 Scoring 逻辑，内部会处理 Rework
                        await this.qualityScoreService.performScoring(
                            job.shotId,
                            job.traceId || '',
                            job.attempts || 1
                        );

                        backfilledCount++;
                    } catch (e: any) {
                        this.logger.error(`[QualitySweeper] Failed to backfill for shot ${job.shotId}: ${e.message}`);
                    }
                }
            }

            if (backfilledCount > 0) {
                this.logger.log(`[QualitySweeper] Successfully backfilled ${backfilledCount} quality scores.`);
            }
        } catch (error: any) {
            this.logger.error(`[QualitySweeper] Error during backfill scan: ${error.message}`);
        }
    }
}
