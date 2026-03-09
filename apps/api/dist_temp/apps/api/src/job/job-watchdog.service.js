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
var JobWatchdogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobWatchdogService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
const config_1 = require("@scu/config");
const JobStatusEnum = database_1.JobStatus;
let JobWatchdogService = JobWatchdogService_1 = class JobWatchdogService {
    prisma;
    logger = new common_1.Logger(JobWatchdogService_1.name);
    jobTimeoutMs;
    workerHeartbeatTimeoutMs;
    constructor(prisma) {
        this.prisma = prisma;
        console.log('[DEBUG_BOOT] JobWatchdogService constructor start');
        this.jobTimeoutMs = config_1.env.jobWatchdogTimeoutMs ?? 3600000;
        this.workerHeartbeatTimeoutMs = config_1.env.workerHeartbeatTimeoutMs || 30000;
        console.log('[DEBUG_BOOT] JobWatchdogService constructor end');
    }
    async recoverStuckJobs() {
        if (config_1.env.jobWatchdogEnabled === false) {
            return;
        }
        try {
            this.logger.debug('[JobWatchdog] Starting stuck job recovery scan...');
            const now = new Date();
            const jobTimeoutThreshold = new Date(now.getTime() - this.jobTimeoutMs);
            const workerTimeoutThreshold = new Date(now.getTime() - this.workerHeartbeatTimeoutMs);
            const stuckJobs = await this.prisma.shotJob.findMany({
                where: {
                    status: JobStatusEnum.RUNNING,
                    OR: [
                        {
                            updatedAt: {
                                lt: jobTimeoutThreshold,
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
                include: {
                    worker: true,
                },
                take: 100,
            });
            if (stuckJobs.length === 0) {
                this.logger.debug('[JobWatchdog] No stuck jobs found');
                return;
            }
            this.logger.warn(`[JobWatchdog] Found ${stuckJobs.length} stuck jobs, starting recovery...`);
            let recoveredCount = 0;
            let failedCount = 0;
            for (const job of stuckJobs) {
                try {
                    const result = await this.prisma.$transaction(async (tx) => {
                        const currentJob = await tx.shotJob.findUnique({
                            where: { id: job.id },
                            include: { worker: true },
                        });
                        if (!currentJob || currentJob.status !== JobStatusEnum.RUNNING) {
                            return { action: 'SKIP' };
                        }
                        const workerIsOnline = currentJob.worker && currentJob.worker.lastHeartbeat >= workerTimeoutThreshold;
                        const isLeaseExpired = currentJob.leaseUntil && currentJob.leaseUntil < now;
                        const isUpdateExpired = currentJob.updatedAt < jobTimeoutThreshold;
                        if (workerIsOnline && !isLeaseExpired) {
                            this.logger.debug(`[JobWatchdog] Job ${currentJob.id} is pending recovery but worker ${currentJob.worker?.workerId} is online and lease is valid.`);
                            return { action: 'ONLINE_SKIP' };
                        }
                        if (workerIsOnline && isLeaseExpired) {
                            this.logger.warn(`[JobWatchdog] FORCED RECOVERY: Job ${currentJob.id} lease expired but worker ${currentJob.worker?.workerId} is still online. ` +
                                `Marking as RETRYING to break the hang.`);
                        }
                        const newRetryCount = currentJob.retryCount + 1;
                        const shouldFail = newRetryCount >= currentJob.maxRetry;
                        let timeoutReason = '';
                        if (isLeaseExpired && isUpdateExpired) {
                            timeoutReason = `lease expired (${currentJob.leaseUntil?.toISOString()}) and updatedAt timeout`;
                        }
                        else if (isLeaseExpired) {
                            timeoutReason = `lease expired at ${currentJob.leaseUntil?.toISOString()}`;
                        }
                        else {
                            timeoutReason = `updatedAt timeout (last update: ${currentJob.updatedAt.toISOString()})`;
                        }
                        await tx.shotJob.update({
                            where: { id: currentJob.id },
                            data: {
                                status: shouldFail ? JobStatusEnum.FAILED : JobStatusEnum.RETRYING,
                                workerId: null,
                                leaseUntil: null,
                                retryCount: newRetryCount,
                                lastError: shouldFail
                                    ? `Job watchdog: Max retries exceeded after worker offline (${timeoutReason})`
                                    : `Job watchdog recovery: Worker ${currentJob.workerId} appears offline (${timeoutReason}, last heartbeat: ${currentJob.worker?.lastHeartbeat})`,
                                updatedAt: now,
                            },
                        });
                        if (shouldFail) {
                            this.logger.warn(`[JobWatchdog] Job ${currentJob.id} marked as FAILED (max retries exceeded)`);
                            return { action: 'FAILED' };
                        }
                        else {
                            this.logger.log(`[JobWatchdog] Recovered job ${currentJob.id} from RUNNING to RETRYING (worker ${currentJob.workerId} offline)`);
                            return { action: 'RECOVERED' };
                        }
                    });
                    if (result.action === 'RECOVERED' || result.action === 'FAILED') {
                        recoveredCount++;
                    }
                }
                catch (error) {
                    failedCount++;
                    const isProd = process.env.NODE_ENV === 'production';
                    if (isProd) {
                        this.logger.error(`[JobWatchdog] Failed to recover job ${job.id}: ${error?.message || 'error'}`);
                    }
                    else {
                        this.logger.error(`[JobWatchdog] Failed to recover job ${job.id}: ${error.message}`, error.stack);
                    }
                }
            }
            this.logger.log(`[JobWatchdog] Recovery completed: ${recoveredCount} recovered, ${failedCount} failed`);
        }
        catch (error) {
            const isProd = process.env.NODE_ENV === 'production';
            if (isProd) {
                this.logger.error(`[JobWatchdog] Error during recovery scan: ${error?.message || 'error'}`);
            }
            else {
                this.logger.error(`[JobWatchdog] Error during recovery scan: ${error.message}`, error.stack);
            }
        }
    }
};
exports.JobWatchdogService = JobWatchdogService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], JobWatchdogService.prototype, "recoverStuckJobs", null);
exports.JobWatchdogService = JobWatchdogService = JobWatchdogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JobWatchdogService);
//# sourceMappingURL=job-watchdog.service.js.map