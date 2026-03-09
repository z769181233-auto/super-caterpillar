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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineProfileService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
const engine_registry_hub_service_1 = require("../engine-hub/engine-registry-hub.service");
let EngineProfileService = class EngineProfileService {
    prisma;
    jobService;
    engineRegistryHub;
    constructor(prisma, jobService, engineRegistryHub) {
        this.prisma = prisma;
        this.jobService = jobService;
        this.engineRegistryHub = engineRegistryHub;
    }
    async getProfileSummary(query) {
        const timeFilter = {};
        if (query.from) {
            timeFilter.gte = new Date(query.from);
        }
        if (query.to) {
            timeFilter.lte = new Date(query.to);
        }
        const where = {};
        if (query.projectId) {
            where.projectId = query.projectId;
        }
        if (query.from || query.to) {
            where.createdAt = timeFilter;
        }
        const jobs = await this.prisma.shotJob.findMany({
            where,
            select: {
                id: true,
                type: true,
                status: true,
                payload: true,
                engineConfig: true,
                retryCount: true,
                createdAt: true,
            },
        });
        const engineMap = new Map();
        for (const job of jobs) {
            const engineKey = this.jobService.extractEngineKeyFromJob(job);
            const engineVersion = this.jobService.extractEngineVersionFromJob(job);
            let adapterName = null;
            try {
                const descriptor = this.engineRegistryHub.find(engineKey, engineVersion || undefined);
                if (descriptor) {
                    adapterName =
                        descriptor.mode === 'local' ? descriptor.adapterToken?.name || engineKey : 'HTTP_API';
                }
                else {
                    adapterName = engineKey;
                }
            }
            catch {
                adapterName = engineKey;
            }
            if (query.engineKey && engineKey !== query.engineKey) {
                continue;
            }
            const key = `${engineKey}::${engineVersion || 'null'}`;
            if (!engineMap.has(key)) {
                engineMap.set(key, {
                    engineKey,
                    engineVersion,
                    adapterName,
                    jobs: [],
                });
            }
            engineMap.get(key).jobs.push(job);
        }
        const summaries = [];
        for (const [key, group] of engineMap.entries()) {
            const jobs = group.jobs;
            const totalJobs = jobs.length;
            const successCount = jobs.filter((j) => j.status === 'SUCCEEDED').length;
            const failedCount = jobs.filter((j) => j.status === 'FAILED').length;
            const retryCount = jobs.reduce((sum, j) => sum + (j.retryCount || 0), 0);
            const qualityScores = [];
            const confidences = [];
            const durations = [];
            const tokens = [];
            const costs = [];
            for (const job of jobs) {
                if (job.payload && typeof job.payload === 'object') {
                    const payload = job.payload;
                    const result = payload.result;
                    if (result?.quality?.score !== null && result?.quality?.score !== undefined) {
                        qualityScores.push(Number(result.quality.score));
                    }
                    if (result?.quality?.confidence !== null && result?.quality?.confidence !== undefined) {
                        confidences.push(Number(result.quality.confidence));
                    }
                    if (result?.metrics?.durationMs !== null && result?.metrics?.durationMs !== undefined) {
                        durations.push(Number(result.metrics.durationMs));
                    }
                    if (result?.metrics?.tokens !== null && result?.metrics?.tokens !== undefined) {
                        tokens.push(Number(result.metrics.tokens));
                    }
                    if (result?.metrics?.costUsd !== null && result?.metrics?.costUsd !== undefined) {
                        costs.push(Number(result.metrics.costUsd));
                    }
                }
            }
            const avgQualityScore = qualityScores.length > 0
                ? qualityScores.reduce((sum, v) => sum + v, 0) / qualityScores.length
                : null;
            const avgConfidence = confidences.length > 0
                ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length
                : null;
            const avgDurationMs = durations.length > 0 ? durations.reduce((sum, v) => sum + v, 0) / durations.length : null;
            const avgTokens = tokens.length > 0 ? tokens.reduce((sum, v) => sum + v, 0) / tokens.length : null;
            const avgCostUsd = costs.length > 0 ? costs.reduce((sum, v) => sum + v, 0) / costs.length : null;
            const successRate = totalJobs > 0 ? successCount / totalJobs : null;
            summaries.push({
                engineKey: group.engineKey,
                engineVersion: group.engineVersion,
                adapterName: group.adapterName,
                totalJobs,
                successCount,
                failedCount,
                retryCount,
                avgQualityScore,
                avgConfidence,
                avgDurationMs,
                avgTokens,
                avgCostUsd,
                successRate,
            });
        }
        return {
            summaries,
            total: summaries.length,
        };
    }
};
exports.EngineProfileService = EngineProfileService;
exports.EngineProfileService = EngineProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        job_service_1.JobService,
        engine_registry_hub_service_1.EngineRegistryHubService])
], EngineProfileService);
//# sourceMappingURL=engine-profile.service.js.map