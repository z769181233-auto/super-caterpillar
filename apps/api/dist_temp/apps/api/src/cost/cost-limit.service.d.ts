import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRef } from '@nestjs/core';
export declare class CostLimitService implements OnModuleInit {
    private prisma;
    private readonly moduleRef;
    private readonly logger;
    private readonly MAX_IMAGES_PER_JOB;
    private readonly MAX_GPU_SECONDS_PER_JOB;
    private readonly MAX_COST_USD_PER_JOB;
    constructor(prisma: PrismaService, moduleRef: ModuleRef);
    onModuleInit(): Promise<void>;
    checkLimitOrThrow(jobId: string, delta: {
        imageCount?: number;
        gpuSeconds?: number;
        costUsd?: number;
    }): Promise<void>;
    preCheckOrThrow(params: {
        jobId: string;
        engineKey: string;
        plannedOutputs?: number;
        plannedGpuSeconds?: number;
        estimatedCostUsd?: number;
    }): Promise<void>;
    preCheckVerificationOrThrow(params: {
        jobId: string;
        engineKey: string;
        capUsd: number;
    }): Promise<void>;
    postApplyUsage(params: {
        jobId: string;
        projectId: string;
        engineKey: string;
        pricingKey: string;
        actualOutputs: number;
        gpuSeconds: number;
        costUsd: number;
        jobType?: string;
        attempt?: number;
        metadata?: any;
    }): Promise<void>;
    postApplyVerificationUsageNoLedger(params: {
        jobId: string;
        engineKey: string;
        costUsd: number;
        metadata?: any;
    }): Promise<void>;
    private calculateJobUsage;
    getLimits(): {
        MAX_IMAGES_PER_JOB: number;
        MAX_GPU_SECONDS_PER_JOB: number;
        MAX_COST_USD_PER_JOB: number;
    };
}
