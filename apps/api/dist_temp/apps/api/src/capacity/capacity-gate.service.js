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
var CapacityGateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityGateService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const JobStatusEnum = database_1.JobStatus;
const JobTypeEnum = database_1.JobType;
let CapacityGateService = CapacityGateService_1 = class CapacityGateService {
    prisma;
    logger = new common_1.Logger(CapacityGateService_1.name);
    MAX_CONCURRENT_VIDEO_RENDER = parseInt(process.env.MAX_CONCURRENT_VIDEO_RENDER || '10', 10);
    MAX_PENDING_JOBS = parseInt(process.env.MAX_PENDING_JOBS || '100', 10);
    MAX_PENDING_VIDEO_RENDER = parseInt(process.env.MAX_PENDING_VIDEO_RENDER || '50', 10);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async checkVideoRenderCapacity(organizationId, userId, tx) {
        if (process.env.CAPACITY_GATE_ENABLED === 'false') {
            this.logger.debug('[CapacityGate] Capacity gate disabled by feature flag');
            return { allowed: true };
        }
        try {
            const client = tx || this.prisma;
            const inProgressCount = await client.shotJob.count({
                where: {
                    organizationId,
                    type: JobTypeEnum.VIDEO_RENDER,
                    status: {
                        in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
                    },
                },
            });
            if (inProgressCount >= this.MAX_CONCURRENT_VIDEO_RENDER) {
                return {
                    allowed: false,
                    reason: `已达到并发渲染上限 (${inProgressCount}/${this.MAX_CONCURRENT_VIDEO_RENDER})`,
                    errorCode: 'CAPACITY_EXCEEDED_CONCURRENT',
                    currentCount: inProgressCount,
                    limit: this.MAX_CONCURRENT_VIDEO_RENDER,
                };
            }
            const pendingCount = await client.shotJob.count({
                where: {
                    organizationId,
                    type: JobTypeEnum.VIDEO_RENDER,
                    status: JobStatusEnum.PENDING,
                },
            });
            if (pendingCount >= this.MAX_PENDING_VIDEO_RENDER) {
                return {
                    allowed: false,
                    reason: `队列积压过多 (${pendingCount}/${this.MAX_PENDING_VIDEO_RENDER})`,
                    errorCode: 'CAPACITY_EXCEEDED_QUEUE',
                    currentCount: pendingCount,
                    limit: this.MAX_PENDING_VIDEO_RENDER,
                };
            }
            const totalPendingCount = await client.shotJob.count({
                where: {
                    organizationId,
                    status: JobStatusEnum.PENDING,
                },
            });
            if (totalPendingCount >= this.MAX_PENDING_JOBS) {
                return {
                    allowed: false,
                    reason: `总队列积压过多 (${totalPendingCount}/${this.MAX_PENDING_JOBS})`,
                    errorCode: 'CAPACITY_EXCEEDED_TOTAL_QUEUE',
                    currentCount: totalPendingCount,
                    limit: this.MAX_PENDING_JOBS,
                };
            }
            if (userId) {
                const userInProgressCount = await client.shotJob.count({
                    where: {
                        organizationId,
                        type: JobTypeEnum.VIDEO_RENDER,
                        status: {
                            in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
                        },
                    },
                });
                const userMaxConcurrent = parseInt(process.env.MAX_USER_CONCURRENT_VIDEO_RENDER || String(this.MAX_CONCURRENT_VIDEO_RENDER), 10);
                if (userInProgressCount >= userMaxConcurrent) {
                    return {
                        allowed: false,
                        reason: `用户并发渲染上限 (${userInProgressCount}/${userMaxConcurrent})`,
                        errorCode: 'CAPACITY_EXCEEDED_USER_CONCURRENT',
                        currentCount: userInProgressCount,
                        limit: userMaxConcurrent,
                    };
                }
            }
            return {
                allowed: true,
                currentCount: inProgressCount,
                limit: this.MAX_CONCURRENT_VIDEO_RENDER,
            };
        }
        catch (error) {
            this.logger.error(`[CapacityGate] Error checking capacity: ${error.message}`, error.stack);
            return {
                allowed: true,
                reason: 'Capacity check failed, allowing by default',
            };
        }
    }
    async checkJobCapacity(jobType, organizationId, userId) {
        if (jobType === JobTypeEnum.VIDEO_RENDER) {
            return this.checkVideoRenderCapacity(organizationId, userId);
        }
        const totalPendingCount = await this.prisma.shotJob.count({
            where: {
                organizationId,
                status: JobStatusEnum.PENDING,
            },
        });
        if (totalPendingCount >= this.MAX_PENDING_JOBS) {
            return {
                allowed: false,
                reason: `总队列积压过多 (${totalPendingCount}/${this.MAX_PENDING_JOBS})`,
                errorCode: 'CAPACITY_EXCEEDED_TOTAL_QUEUE',
                currentCount: totalPendingCount,
                limit: this.MAX_PENDING_JOBS,
            };
        }
        return { allowed: true };
    }
    async getCapacityUsage(organizationId) {
        const [inProgress, pending, totalPending] = await Promise.all([
            this.prisma.shotJob.count({
                where: {
                    organizationId,
                    type: JobTypeEnum.VIDEO_RENDER,
                    status: {
                        in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
                    },
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    organizationId,
                    type: JobTypeEnum.VIDEO_RENDER,
                    status: JobStatusEnum.PENDING,
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    organizationId,
                    status: JobStatusEnum.PENDING,
                },
            }),
        ]);
        return {
            videoRender: {
                inProgress,
                pending,
                limit: this.MAX_CONCURRENT_VIDEO_RENDER,
                pendingLimit: this.MAX_PENDING_VIDEO_RENDER,
            },
            total: {
                pending: totalPending,
                limit: this.MAX_PENDING_JOBS,
            },
        };
    }
};
exports.CapacityGateService = CapacityGateService;
exports.CapacityGateService = CapacityGateService = CapacityGateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CapacityGateService);
//# sourceMappingURL=capacity-gate.service.js.map