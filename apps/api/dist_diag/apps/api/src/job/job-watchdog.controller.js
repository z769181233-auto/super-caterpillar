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
exports.JobWatchdogController = void 0;
const common_1 = require("@nestjs/common");
const job_watchdog_service_1 = require("./job-watchdog.service");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
let JobWatchdogController = class JobWatchdogController {
    watchdogService;
    prisma;
    constructor(watchdogService, prisma) {
        this.watchdogService = watchdogService;
        this.prisma = prisma;
    }
    async triggerWatchdog() {
        await this.watchdogService.recoverStuckJobs();
        return {
            success: true,
            message: 'Watchdog scan triggered manually',
            timestamp: new Date().toISOString(),
        };
    }
    async getStuckJobs() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const stuckJobs = await this.prisma.shotJob.findMany({
            where: {
                status: database_1.JobStatus.RUNNING,
                OR: [
                    {
                        updatedAt: {
                            lt: oneHourAgo,
                        },
                    },
                    {
                        leaseUntil: {
                            not: null,
                            lt: now,
                        },
                    },
                ],
            },
            select: {
                id: true,
                type: true,
                status: true,
                workerId: true,
                retryCount: true,
                maxRetry: true,
                createdAt: true,
                updatedAt: true,
                leaseUntil: true,
                lastError: true,
                worker: {
                    select: {
                        workerId: true,
                        lastHeartbeat: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'asc',
            },
            take: 50,
        });
        return {
            success: true,
            count: stuckJobs.length,
            jobs: stuckJobs.map((job) => ({
                ...job,
                stuckDuration: Math.floor((now.getTime() - job.updatedAt.getTime()) / 1000),
                leaseExpired: job.leaseUntil ? job.leaseUntil < now : false,
            })),
            timestamp: now.toISOString(),
        };
    }
    async getWatchdogStats() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [totalRunning, stuckByUpdatedAt, stuckByLease, stuckBoth, recoveredLast24h, failedLast24h,] = await Promise.all([
            this.prisma.shotJob.count({
                where: { status: database_1.JobStatus.RUNNING },
            }),
            this.prisma.shotJob.count({
                where: {
                    status: database_1.JobStatus.RUNNING,
                    updatedAt: { lt: oneHourAgo },
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    status: database_1.JobStatus.RUNNING,
                    leaseUntil: {
                        not: null,
                        lt: now,
                    },
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    status: database_1.JobStatus.RUNNING,
                    updatedAt: { lt: oneHourAgo },
                    leaseUntil: {
                        not: null,
                        lt: now,
                    },
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    status: database_1.JobStatus.RETRYING,
                    updatedAt: { gte: oneDayAgo },
                    lastError: {
                        contains: 'Job watchdog recovery',
                    },
                },
            }),
            this.prisma.shotJob.count({
                where: {
                    status: database_1.JobStatus.FAILED,
                    updatedAt: { gte: oneDayAgo },
                    lastError: {
                        contains: 'Job watchdog: Max retries exceeded',
                    },
                },
            }),
        ]);
        return {
            success: true,
            stats: {
                totalRunning,
                stuck: {
                    byUpdatedAt: stuckByUpdatedAt,
                    byLease: stuckByLease,
                    both: stuckBoth,
                    total: Math.max(stuckByUpdatedAt, stuckByLease),
                },
                last24h: {
                    recovered: recoveredLast24h,
                    failed: failedLast24h,
                },
            },
            timestamp: now.toISOString(),
        };
    }
};
exports.JobWatchdogController = JobWatchdogController;
__decorate([
    (0, common_1.Post)('trigger'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobWatchdogController.prototype, "triggerWatchdog", null);
__decorate([
    (0, common_1.Get)('stuck-jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobWatchdogController.prototype, "getStuckJobs", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobWatchdogController.prototype, "getWatchdogStats", null);
exports.JobWatchdogController = JobWatchdogController = __decorate([
    (0, common_1.Controller)('api/ops/job-watchdog'),
    __metadata("design:paramtypes", [job_watchdog_service_1.JobWatchdogService,
        prisma_service_1.PrismaService])
], JobWatchdogController);
//# sourceMappingURL=job-watchdog.controller.js.map