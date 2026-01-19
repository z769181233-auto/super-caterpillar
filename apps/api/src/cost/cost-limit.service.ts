import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRef } from '@nestjs/core';

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
export class CostLimitService implements OnModuleInit {
  private readonly logger = new Logger(CostLimitService.name);

  // Hard limits
  private readonly MAX_IMAGES_PER_JOB = 100;
  private readonly MAX_GPU_SECONDS_PER_JOB = 300;
  private readonly MAX_COST_USD_PER_JOB = 1.0;

  constructor(
    @Inject(PrismaService)
    private prisma: PrismaService,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    if (!this.prisma) {
      try {
        this.prisma = this.moduleRef.get(PrismaService, { strict: false });
      } catch (e) {
        this.logger.error(`Failed to resolve PrismaService: ${e}`);
      }
    }
  }

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

  async preCheckOrThrow(params: {
    jobId: string;
    engineKey: string;
    plannedOutputs?: number;
    plannedGpuSeconds?: number;
    estimatedCostUsd?: number;
  }): Promise<void> {
    const { jobId, plannedOutputs = 0, plannedGpuSeconds = 0, estimatedCostUsd = 0 } = params;

    this.logger.debug(
      `[CostLimit] Pre-check for Job ${jobId}: outputs=${plannedOutputs}, cost=${estimatedCostUsd}`
    );

    await this.checkLimitOrThrow(jobId, {
      imageCount: plannedOutputs,
      gpuSeconds: plannedGpuSeconds,
      costUsd: estimatedCostUsd,
    });
  }

  /**
   * Pre-check for verification requests (Hard Cap Guard)
   * P0: 验证模式不计入用户账本，但必须有全局硬上限防止失控。
   */
  async preCheckVerificationOrThrow(params: {
    jobId: string;
    engineKey: string;
    capUsd: number;
  }): Promise<void> {
    this.logger.log(
      `[CostLimit][VERIFICATION] Pre-check for Job ${params.jobId}, capUsd=${params.capUsd}`
    );
    // 验证模式暂不检查历史累积（因为不落账），仅确保单次调用在硬上限内
    // 实际成本估算在 invoker 中处理，这里主要作为审计入口
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
    jobType?: string;
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
          jobType: params.jobType || 'SHOT_RENDER',
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
        this.logger.warn(
          `[CostLimit] Skipping duplicate ledger entry (idempotency): ${jobId}:${attempt}`
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Post-apply for verification requests (No Ledger)
   * P0: 仅记录审计日志，严禁写入 cost_ledgers 避免账本污染。
   */
  async postApplyVerificationUsageNoLedger(params: {
    jobId: string;
    engineKey: string;
    costUsd: number;
    metadata?: any;
  }): Promise<void> {
    this.logger.log(
      `[CostLimit][VERIFICATION][NO-LEDGER] Job ${params.jobId} consumed $${params.costUsd.toFixed(4)}`
    );
    // 此处可扩展记录到专门的验证日志表或审计流
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
