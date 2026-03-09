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
exports.OpsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const prisma_service_1 = require("../prisma/prisma.service");
const ops_metrics_service_1 = require("./ops-metrics.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
let OpsController = class OpsController {
    prisma;
    metricsService;
    constructor(prisma, metricsService) {
        this.prisma = prisma;
        this.metricsService = metricsService;
    }
    async getMetrics() {
        return this.metricsService.getProductionMetrics();
    }
    async diagnoseJob(jobId) {
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_OPS_ENDPOINTS) {
            throw new common_1.NotFoundException('Diagnostic endpoint not available in production');
        }
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: {
                worker: true,
                task: true,
                engineBinding: {
                    include: {
                        engine: true,
                        engineVersion: true,
                    },
                },
            },
        });
        if (!job) {
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        }
        const auditLogs = await this.prisma.auditLog.findMany({
            where: {
                resourceId: jobId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 20,
        });
        return {
            job: {
                id: job.id,
                type: job.type,
                status: job.status,
                priority: job.priority,
                maxRetry: job.maxRetry,
                retryCount: job.retryCount,
                attempts: job.attempts,
                workerId: job.workerId,
                worker: job.worker
                    ? {
                        id: job.worker.id,
                        workerId: job.worker.workerId,
                        status: job.worker.status,
                        lastHeartbeat: job.worker.lastHeartbeat,
                    }
                    : null,
                taskId: job.taskId,
                task: job.task
                    ? {
                        id: job.task.id,
                        type: job.task.type,
                        status: job.task.status,
                    }
                    : null,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                lastError: job.lastError,
                traceId: job.traceId,
            },
            engineBinding: job.engineBinding
                ? {
                    id: job.engineBinding.id,
                    engineId: job.engineBinding.engineId,
                    engineKey: job.engineBinding.engineKey,
                    engineVersionId: job.engineBinding.engineVersionId,
                    status: job.engineBinding.status,
                    boundAt: job.engineBinding.boundAt,
                    executedAt: job.engineBinding.executedAt,
                    completedAt: job.engineBinding.completedAt,
                    errorMessage: job.engineBinding.errorMessage,
                    engine: job.engineBinding.engine
                        ? {
                            id: job.engineBinding.engine.id,
                            engineKey: job.engineBinding.engine.engineKey,
                            adapterName: job.engineBinding.engine.adapterName,
                            enabled: job.engineBinding.engine.enabled,
                        }
                        : null,
                    engineVersion: job.engineBinding.engineVersion
                        ? {
                            id: job.engineBinding.engineVersion.id,
                            versionName: job.engineBinding.engineVersion.versionName,
                            enabled: job.engineBinding.engineVersion.enabled,
                        }
                        : null,
                }
                : null,
            auditLogs: auditLogs.map((log) => ({
                id: log.id,
                action: log.action,
                resourceType: log.resourceType,
                resourceId: log.resourceId,
                details: log.details,
                createdAt: log.createdAt,
            })),
        };
    }
};
exports.OpsController = OpsController;
__decorate([
    (0, common_1.Get)('metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)('jobs/:id/diagnose'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OpsController.prototype, "diagnoseJob", null);
exports.OpsController = OpsController = __decorate([
    (0, common_1.Controller)('ops'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard, throttler_1.ThrottlerGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ops_metrics_service_1.OpsMetricsService])
], OpsController);
//# sourceMappingURL=ops.controller.js.map