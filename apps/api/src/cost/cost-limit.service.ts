import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cost Limit Service (P0 - Production Readiness)
 * 
 * Enforces hard limits on resource consumption per job:
 * - MAX_IMAGES_PER_JOB: 100
 * - MAX_COST_USD_PER_JOB: 1.0
 * - MAX_GPU_SECONDS_PER_JOB: 300
 * 
 * Required by: 项目成本控制与生产效率体系说明书_ProductionEfficiencySpec
 */
@Injectable()
export class CostLimitService {
    private readonly logger = new Logger(CostLimitService.name);

    // Hard limits
    private readonly MAX_IMAGES_PER_JOB = 100;
    private readonly MAX_GPU_SECONDS_PER_JOB = 300;
    private readonly MAX_COST_USD_PER_JOB = 1.0;

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if adding delta would exceed job limits
     * @throws Error with code JOB_LIMIT_EXCEEDED if limit would be exceeded
     */
    async checkLimitOrThrow(
        jobId: string,
        delta: {
            imageCount?: number;
            gpuSeconds?: number;
            costUsd?: number;
        }
    ): Promise<void> {
        // Get current usage from cost_ledgers
        const currentUsage = await this.calculateJobUsage(jobId);

        // Check image count limit
        if (delta.imageCount) {
            const newImageCount = currentUsage.imageCount + delta.imageCount;
            if (newImageCount > this.MAX_IMAGES_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: Image count limit reached (${newImageCount}/${this.MAX_IMAGES_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }

        // Check GPU seconds limit
        if (delta.gpuSeconds) {
            const newGpuSeconds = currentUsage.gpuSeconds + delta.gpuSeconds;
            if (newGpuSeconds > this.MAX_GPU_SECONDS_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: GPU seconds limit reached (${newGpuSeconds}/${this.MAX_GPU_SECONDS_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }

        // Check cost limit
        if (delta.costUsd) {
            const newCost = currentUsage.totalCost + delta.costUsd;
            if (newCost > this.MAX_COST_USD_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: Cost limit reached ($${newCost.toFixed(4)}/$${this.MAX_COST_USD_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }
    }

    /**
     * Pre-invocation check (Budget Guard)
     */
    async preCheckOrThrow(params: {
        jobId: string;
        engineKey: string;
        plannedOutputs?: number;
        plannedGpuSeconds?: number;
        estimatedCostUsd?: number;
    }): Promise<void> {
        const { jobId, plannedOutputs = 0, plannedGpuSeconds = 0, estimatedCostUsd = 0 } = params;

        this.logger.debug(`[CostLimit] Pre-check for Job ${jobId}: outputs=${plannedOutputs}, cost=${estimatedCostUsd}`);

        await this.checkLimitOrThrow(jobId, {
            imageCount: plannedOutputs,
            gpuSeconds: plannedGpuSeconds,
            costUsd: estimatedCostUsd,
        });
    }

    /**
     * Post-invocation accounting (Billing Guard)
     */
    async postApplyUsage(params: {
        jobId: string;
        projectId: string; // Required by schema
        engineKey: string;
        pricingKey: string;
        actualOutputs: number;
        gpuSeconds: number;
        costUsd: number;
        attempt?: number; // Used for idempotency [jobId, attempt]
        metadata?: any;
    }): Promise<void> {
        const { jobId, projectId, costUsd, actualOutputs, gpuSeconds, attempt = 0 } = params;

        // 1. Double check before persistence
        await this.checkLimitOrThrow(jobId, {
            imageCount: actualOutputs,
            gpuSeconds: gpuSeconds,
            costUsd: costUsd,
        });

        // 2. Persist to costLedger using [jobId, attempt] for idempotency
        try {
            await this.prisma.costLedger.create({
                data: {
                    jobId,
                    projectId,
                    jobType: 'SHOT_RENDER', // Fixed for this phase
                    engineKey: params.engineKey,
                    costAmount: costUsd,
                    billingUnit: 'images',
                    quantity: actualOutputs,
                    attempt: attempt,
                    metadata: {
                        ...params.metadata,
                        pricingKey: params.pricingKey,
                        gpuSeconds,
                    },
                },
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                this.logger.warn(`[CostLimit] Skipping duplicate ledger entry (idempotency): ${jobId}:${attempt}`);
                return;
            }
            throw error;
        }
    }

    /**
     * Calculate current job usage from cost_ledgers
     */
    private async calculateJobUsage(jobId: string): Promise<{
        imageCount: number;
        gpuSeconds: number;
        totalCost: number;
    }> {
        // Query cost_ledgers for this job
        const ledgers = await this.prisma.costLedger.findMany({
            where: {
                jobId: jobId,
            },
        });

        let imageCount = 0;
        let gpuSeconds = 0;
        let totalCost = 0;

        for (const ledger of ledgers) {
            // Count images (billingUnit = 'images' or engineKey contains 'shot_render')
            if (
                ledger.billingUnit === 'images' ||
                (ledger.metadata as any)?.engineKey === 'shot_render'
            ) {
                imageCount += ledger.quantity || 0;
            }

            // Sum GPU seconds
            if ((ledger.metadata as any)?.gpuSeconds) {
                gpuSeconds += parseFloat((ledger.metadata as any).gpuSeconds);
            }

            // Sum cost
            totalCost += parseFloat(ledger.costAmount as any) || 0;
        }

        return { imageCount, gpuSeconds, totalCost };
    }

    /**
     * Get current limits (for reporting)
     */
    getLimits() {
        return {
            MAX_IMAGES_PER_JOB: this.MAX_IMAGES_PER_JOB,
            MAX_GPU_SECONDS_PER_JOB: this.MAX_GPU_SECONDS_PER_JOB,
            MAX_COST_USD_PER_JOB: this.MAX_COST_USD_PER_JOB,
        };
    }
}
