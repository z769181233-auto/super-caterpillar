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
var EngineTaskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineTaskService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const database_1 = require("database");
let EngineTaskService = EngineTaskService_1 = class EngineTaskService {
    prisma;
    engineRegistry;
    logger = new common_1.Logger(EngineTaskService_1.name);
    constructor(prisma, engineRegistry) {
        this.prisma = prisma;
        this.engineRegistry = engineRegistry;
        console.log('[DEBUG_BOOT] EngineTaskService constructor start');
        console.log('[DEBUG_BOOT] EngineTaskService constructor end');
    }
    async findEngineTaskByTaskId(taskId) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: {
                jobs: {
                    where: {
                        type: database_1.JobType.NOVEL_ANALYSIS,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!task) {
            return null;
        }
        if (!task.jobs || task.jobs.length === 0) {
            this.logger.debug(`Task ${taskId} has no NOVEL_ANALYSIS jobs`);
            return null;
        }
        const engineKey = this.extractEngineKey(task, task.jobs[0]);
        const adapterName = this.extractAdapterName(engineKey, task.type);
        const jobs = task.jobs.map((job) => this.mapJobToSummary(job));
        return {
            taskId: task.id,
            projectId: task.projectId,
            taskType: task.type,
            status: task.status,
            engineKey,
            adapterName,
            jobs,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
        };
    }
    async findEngineTasksByProject(projectId, taskType) {
        const where = {
            projectId,
        };
        if (taskType) {
            where.type = taskType;
        }
        const tasks = await this.prisma.task.findMany({
            where,
            include: {
                jobs: {
                    where: {
                        type: database_1.JobType.NOVEL_ANALYSIS,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const engineTasks = [];
        for (const task of tasks) {
            if (!task.jobs || task.jobs.length === 0) {
                continue;
            }
            const engineKey = this.extractEngineKey(task, task.jobs[0]);
            const adapterName = this.extractAdapterName(engineKey, task.type);
            const jobs = task.jobs.map((job) => this.mapJobToSummary(job));
            engineTasks.push({
                taskId: task.id,
                projectId: task.projectId,
                taskType: task.type,
                status: task.status,
                engineKey,
                adapterName,
                jobs,
                createdAt: task.createdAt.toISOString(),
                updatedAt: task.updatedAt.toISOString(),
            });
        }
        return engineTasks;
    }
    extractEngineKey(task, job) {
        if (job?.payload && typeof job.payload === 'object') {
            const jobPayload = job.payload;
            if (jobPayload.engineKey && typeof jobPayload.engineKey === 'string') {
                return jobPayload.engineKey;
            }
        }
        if (task?.payload && typeof task.payload === 'object') {
            const taskPayload = task.payload;
            if (taskPayload.engineKey && typeof taskPayload.engineKey === 'string') {
                return taskPayload.engineKey;
            }
        }
        const defaultKey = this.getDefaultEngineKeyForTaskType(task.type);
        if (defaultKey) {
            return defaultKey;
        }
        return 'default_novel_analysis';
    }
    getDefaultEngineKeyForTaskType(taskType) {
        const taskTypeToEngineKey = {
            NOVEL_ANALYSIS: 'default_novel_analysis',
            SHOT_RENDER: 'default_shot_render',
        };
        return taskTypeToEngineKey[taskType] || null;
    }
    extractAdapterName(engineKey, taskType) {
        try {
            const adapter = this.engineRegistry.getAdapter(engineKey);
            if (adapter) {
                return adapter.name;
            }
            const foundAdapter = this.engineRegistry.findAdapter(engineKey, taskType);
            if (foundAdapter) {
                return foundAdapter.name;
            }
            this.logger.warn(`Adapter not found for engineKey: ${engineKey}, using engineKey as adapterName`);
            return engineKey;
        }
        catch (error) {
            this.logger.warn(`Error finding adapter for engineKey: ${engineKey}, using engineKey as adapterName`, error);
            return engineKey;
        }
    }
    mapJobToSummary(job) {
        const statusMap = {
            PENDING: 'PENDING',
            RUNNING: 'RUNNING',
            SUCCEEDED: 'SUCCEEDED',
            FAILED: 'FAILED',
            RETRYING: 'RETRYING',
        };
        const status = statusMap[job.status] || 'PENDING';
        return {
            id: job.id,
            jobType: job.type,
            status,
            attempts: job.attempts || 0,
            retryCount: job.retryCount || 0,
            maxRetry: job.maxRetry || null,
            createdAt: job.createdAt.toISOString(),
            startedAt: job.startedAt ? job.startedAt.toISOString() : null,
            finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
        };
    }
};
exports.EngineTaskService = EngineTaskService;
exports.EngineTaskService = EngineTaskService = EngineTaskService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        engine_registry_service_1.EngineRegistry])
], EngineTaskService);
//# sourceMappingURL=engine-task.service.js.map