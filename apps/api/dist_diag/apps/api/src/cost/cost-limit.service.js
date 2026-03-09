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
var CostLimitService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostLimitService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const core_1 = require("@nestjs/core");
let CostLimitService = CostLimitService_1 = class CostLimitService {
    prisma;
    moduleRef;
    logger = new common_1.Logger(CostLimitService_1.name);
    MAX_IMAGES_PER_JOB = 100;
    MAX_GPU_SECONDS_PER_JOB = 300;
    MAX_COST_USD_PER_JOB = 1.0;
    constructor(prisma, moduleRef) {
        this.prisma = prisma;
        this.moduleRef = moduleRef;
    }
    async onModuleInit() {
        if (!this.prisma) {
            try {
                this.prisma = this.moduleRef.get(prisma_service_1.PrismaService, { strict: false });
            }
            catch (e) {
                this.logger.error(`Failed to resolve PrismaService: ${e}`);
            }
        }
    }
    async checkLimitOrThrow(jobId, delta) {
        const currentUsage = await this.calculateJobUsage(jobId);
        if (delta.imageCount) {
            const newImageCount = currentUsage.imageCount + delta.imageCount;
            if (newImageCount > this.MAX_IMAGES_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: Image count limit reached (${newImageCount}/${this.MAX_IMAGES_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }
        if (delta.gpuSeconds) {
            const newGpuSeconds = currentUsage.gpuSeconds + delta.gpuSeconds;
            if (newGpuSeconds > this.MAX_GPU_SECONDS_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: GPU seconds limit reached (${newGpuSeconds}/${this.MAX_GPU_SECONDS_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }
        if (delta.costUsd) {
            const newCost = currentUsage.totalCost + delta.costUsd;
            if (newCost > this.MAX_COST_USD_PER_JOB) {
                const error = `JOB_LIMIT_EXCEEDED: Cost limit reached ($${newCost.toFixed(4)}/$${this.MAX_COST_USD_PER_JOB})`;
                this.logger.error(error);
                throw new Error(error);
            }
        }
    }
    async preCheckOrThrow(params) {
        const { jobId, plannedOutputs = 0, plannedGpuSeconds = 0, estimatedCostUsd = 0 } = params;
        this.logger.debug(`[CostLimit] Pre-check for Job ${jobId}: outputs=${plannedOutputs}, cost=${estimatedCostUsd}`);
        await this.checkLimitOrThrow(jobId, {
            imageCount: plannedOutputs,
            gpuSeconds: plannedGpuSeconds,
            costUsd: estimatedCostUsd,
        });
    }
    async preCheckVerificationOrThrow(params) {
        this.logger.log(`[CostLimit][VERIFICATION] Pre-check for Job ${params.jobId}, capUsd=${params.capUsd}`);
    }
    async postApplyUsage(params) {
        const { jobId, projectId, costUsd, actualOutputs, gpuSeconds, attempt = 0 } = params;
        await this.checkLimitOrThrow(jobId, {
            imageCount: actualOutputs,
            gpuSeconds: gpuSeconds,
            costUsd: costUsd,
        });
        this.logger.log(`[CostLimit] Job ${jobId} used ${costUsd} USD. Ledger update deferred to Job Status Transition.`);
    }
    async postApplyVerificationUsageNoLedger(params) {
        this.logger.log(`[CostLimit][VERIFICATION][NO-LEDGER] Job ${params.jobId} consumed $${params.costUsd.toFixed(4)}`);
    }
    async calculateJobUsage(jobId) {
        const ledgers = await this.prisma.billingLedger.findMany({
            where: {
                jobId: jobId,
            },
        });
        const imageCount = 0;
        const gpuSeconds = 0;
        let totalCost = 0;
        for (const ledger of ledgers) {
            totalCost += Number(ledger.amount || 0n) / 100;
        }
        return { imageCount, gpuSeconds, totalCost };
    }
    getLimits() {
        return {
            MAX_IMAGES_PER_JOB: this.MAX_IMAGES_PER_JOB,
            MAX_GPU_SECONDS_PER_JOB: this.MAX_GPU_SECONDS_PER_JOB,
            MAX_COST_USD_PER_JOB: this.MAX_COST_USD_PER_JOB,
        };
    }
};
exports.CostLimitService = CostLimitService;
exports.CostLimitService = CostLimitService = CostLimitService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.ModuleRef])
], CostLimitService);
//# sourceMappingURL=cost-limit.service.js.map