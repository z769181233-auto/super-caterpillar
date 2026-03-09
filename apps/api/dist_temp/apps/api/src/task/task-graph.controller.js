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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskGraphController = void 0;
const common_1 = require("@nestjs/common");
const task_graph_service_1 = require("./task-graph.service");
const quality_score_service_1 = require("../quality/quality-score.service");
const quality_feedback_service_1 = require("../quality/quality-feedback.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const prisma_service_1 = require("../prisma/prisma.service");
const job_service_1 = require("../job/job.service");
const crypto_1 = require("crypto");
let TaskGraphController = class TaskGraphController {
    taskGraphService;
    qualityScoreService;
    qualityFeedbackService;
    engineRegistry;
    engineConfigStore;
    prisma;
    jobService;
    constructor(taskGraphService, qualityScoreService, qualityFeedbackService, engineRegistry, engineConfigStore, prisma, jobService) {
        this.taskGraphService = taskGraphService;
        this.qualityScoreService = qualityScoreService;
        this.qualityFeedbackService = qualityFeedbackService;
        this.engineRegistry = engineRegistry;
        this.engineConfigStore = engineConfigStore;
        this.prisma = prisma;
        this.jobService = jobService;
    }
    async getTaskGraph(taskId) {
        const graph = await this.taskGraphService.findTaskGraph(taskId);
        if (!graph) {
            return {
                success: false,
                error: {
                    code: 'TASK_NOT_FOUND',
                    message: `Task ${taskId} not found`,
                },
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        const qualityScores = await this.buildQualityScores(taskId, graph.jobs);
        const qualityFeedback = this.qualityFeedbackService.evaluateQualityScores(qualityScores);
        const jobsWithEngineInfo = await this.enrichJobsWithEngineInfo(graph.jobs, qualityScores);
        return {
            success: true,
            data: {
                ...graph,
                jobs: jobsWithEngineInfo,
                qualityScores,
                qualityFeedback,
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async enrichJobsWithEngineInfo(jobs, qualityScores) {
        const jobIds = jobs.map((job) => job.jobId);
        if (jobIds.length === 0) {
            return jobs;
        }
        const rawJobs = await this.prisma.shotJob.findMany({
            where: {
                id: { in: jobIds },
            },
        });
        const jobMap = new Map(rawJobs.map((job) => [job.id, job]));
        const qualityScoreMap = new Map(qualityScores.map((qs) => [qs.jobId, qs]));
        return Promise.all(jobs.map(async (jobNode) => {
            const rawJob = jobMap.get(jobNode.jobId);
            if (!rawJob) {
                return {
                    ...jobNode,
                    engineKey: 'default_novel_analysis',
                    engineVersion: null,
                    adapterName: 'default_novel_analysis',
                    qualityScore: null,
                    metrics: null,
                };
            }
            const engineKey = this.jobService.extractEngineKeyFromJob(rawJob);
            const engineVersion = this.jobService.extractEngineVersionFromJob(rawJob);
            const adapter = this.engineRegistry.getAdapter(engineKey);
            let adapterName = adapter?.name || engineKey;
            if (!adapter) {
                const engineConfig = await this.engineConfigStore.findByEngineKey(engineKey);
                if (engineConfig?.adapterName) {
                    adapterName = engineConfig.adapterName;
                }
            }
            const qualityScoreRecord = qualityScoreMap.get(jobNode.jobId);
            const qualityScore = qualityScoreRecord
                ? {
                    score: qualityScoreRecord.quality?.score ?? null,
                    confidence: qualityScoreRecord.quality?.confidence ?? null,
                }
                : null;
            const metrics = qualityScoreRecord
                ? {
                    durationMs: qualityScoreRecord.metrics?.durationMs ?? null,
                    costUsd: qualityScoreRecord.metrics?.costUsd ?? null,
                    tokens: qualityScoreRecord.metrics?.tokens ?? null,
                }
                : null;
            return {
                ...jobNode,
                engineKey,
                engineVersion,
                adapterName,
                qualityScore,
                metrics,
            };
        }));
    }
    async buildQualityScores(taskId, jobs) {
        const jobIds = jobs.map((job) => job.jobId);
        if (jobIds.length === 0) {
            return [];
        }
        const rawJobs = await this.prisma.shotJob.findMany({
            where: {
                id: { in: jobIds },
            },
        });
        const qualityScores = [];
        for (const job of rawJobs) {
            const engineKey = this.jobService.extractEngineKeyFromJob(job);
            const adapter = this.engineRegistry.getAdapter(engineKey);
            const qualityScore = this.qualityScoreService.buildQualityScoreFromJob(job, adapter, taskId);
            if (qualityScore) {
                qualityScores.push(qualityScore);
            }
        }
        return qualityScores;
    }
};
exports.TaskGraphController = TaskGraphController;
__decorate([
    (0, common_1.Get)(':taskId/graph'),
    __param(0, (0, common_1.Param)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaskGraphController.prototype, "getTaskGraph", null);
exports.TaskGraphController = TaskGraphController = __decorate([
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [task_graph_service_1.TaskGraphService,
        quality_score_service_1.QualityScoreService,
        quality_feedback_service_1.QualityFeedbackService,
        engine_registry_service_1.EngineRegistry,
        engine_config_store_service_1.EngineConfigStoreService,
        prisma_service_1.PrismaService,
        job_service_1.JobService])
], TaskGraphController);
//# sourceMappingURL=task-graph.controller.js.map