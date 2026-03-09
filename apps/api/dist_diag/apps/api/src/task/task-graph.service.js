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
var TaskGraphService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskGraphService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TaskGraphService = TaskGraphService_1 = class TaskGraphService {
    prisma;
    logger = new common_1.Logger(TaskGraphService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
        console.log('[DEBUG_BOOT] TaskGraphService constructor start');
        console.log('[DEBUG_BOOT] TaskGraphService constructor end');
    }
    async findTaskGraph(taskId) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: {
                jobs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!task) {
            return null;
        }
        const jobs = task.jobs.map((job) => {
            const finishedAt = job.status === 'SUCCEEDED' || job.status === 'FAILED' ? job.updatedAt : null;
            const startedAt = job.status === 'RUNNING' || job.status === 'SUCCEEDED' || job.status === 'FAILED'
                ? job.updatedAt
                : null;
            return {
                jobId: job.id,
                jobType: job.type,
                status: job.status,
                attempts: job.attempts || 0,
                retryCount: job.retryCount || 0,
                maxRetry: job.maxRetry || null,
                createdAt: job.createdAt.toISOString(),
                startedAt: startedAt ? startedAt.toISOString() : null,
                finishedAt: finishedAt ? finishedAt.toISOString() : null,
            };
        });
        return {
            taskId: task.id,
            projectId: task.projectId,
            taskType: task.type,
            status: task.status,
            jobs,
        };
    }
};
exports.TaskGraphService = TaskGraphService;
exports.TaskGraphService = TaskGraphService = TaskGraphService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TaskGraphService);
//# sourceMappingURL=task-graph.service.js.map