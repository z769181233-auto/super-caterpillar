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
exports.ObservabilityController = void 0;
const common_1 = require("@nestjs/common");
const terminus_1 = require("@nestjs/terminus");
const prisma_service_1 = require("../prisma/prisma.service");
let ObservabilityController = class ObservabilityController {
    health;
    memory;
    prisma;
    constructor(health, memory, prisma) {
        this.health = health;
        this.memory = memory;
        this.prisma = prisma;
    }
    check() {
        return this.health.check([
            () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
            async () => {
                try {
                    await this.prisma.$queryRaw `SELECT 1`;
                    return {
                        database: {
                            status: 'up',
                        },
                    };
                }
                catch (e) {
                    throw new terminus_1.HealthCheckError('Database check failed', {
                        database: {
                            status: 'down',
                            message: e.message,
                        },
                    });
                }
            },
        ]);
    }
    async getBatchProgress(projectId) {
        const counts = await this.prisma.shotJob.groupBy({
            by: ['status'],
            where: { projectId },
            _count: true,
        });
        const metricsMap = counts.reduce((acc, curr) => {
            acc[curr.status.toLowerCase()] = curr._count;
            return acc;
        }, {});
        return {
            projectId,
            timestamp: Date.now(),
            succeeded: metricsMap['succeeded'] || 0,
            failed: metricsMap['failed'] || 0,
            pending: (metricsMap['pending'] || 0) + (metricsMap['creating'] || 0) + (metricsMap['running'] || 0),
        };
    }
};
exports.ObservabilityController = ObservabilityController;
__decorate([
    (0, common_1.Get)('health'),
    (0, terminus_1.HealthCheck)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/batch-progress'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "getBatchProgress", null);
exports.ObservabilityController = ObservabilityController = __decorate([
    (0, common_1.Controller)('observability'),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        terminus_1.MemoryHealthIndicator,
        prisma_service_1.PrismaService])
], ObservabilityController);
//# sourceMappingURL=observability.controller.js.map