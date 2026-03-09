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
var JobUpdateOpsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobUpdateOpsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const task_service_1 = require("../task/task.service");
const billing_service_1 = require("../billing/billing.service");
const copyright_service_1 = require("../copyright/copyright.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const audit_constants_1 = require("../audit/audit.constants");
const job_retry_1 = require("./job.retry");
const job_service_queries_1 = require("./job.service.queries");
let JobUpdateOpsService = JobUpdateOpsService_1 = class JobUpdateOpsService {
    prisma;
    auditLogService;
    taskService;
    billingService;
    copyrightService;
    eventEmitter;
    logger = new common_1.Logger(JobUpdateOpsService_1.name);
    constructor(prisma, auditLogService, taskService, billingService, copyrightService, eventEmitter) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.taskService = taskService;
        this.billingService = billingService;
        this.copyrightService = copyrightService;
        this.eventEmitter = eventEmitter;
    }
    async ackJob(jobId, workerId) {
        const workerNode = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!workerNode)
            throw new common_1.ForbiddenException(`Worker ${workerId} not found`);
        const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
        if (!job)
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        if (job.workerId !== workerNode.id)
            throw new common_1.ForbiddenException(`Job ownership mismatch`);
        if (job.status === 'RUNNING')
            return { status: 'RUNNING', idempotent: true };
        if (job.status !== 'DISPATCHED')
            throw new common_1.BadRequestException(`Cannot ack job in status ${job.status}`);
        await this.prisma.shotJob.update({
            where: { id: jobId },
            data: { status: 'RUNNING' },
        });
        return { status: 'RUNNING', idempotent: false };
    }
    async reportJobResult(jobId, result, userId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
        });
        if (!job)
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        const updatedJob = await this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: result.status,
                result: result.result,
                lastError: result.errorMessage,
                updatedAt: new Date(),
            },
        });
        try {
            await this.auditLogService.record({
                userId,
                action: result.status === 'SUCCEEDED' ? audit_constants_1.AuditActions.JOB_SUCCEEDED : audit_constants_1.AuditActions.JOB_FAILED,
                resourceType: 'job',
                resourceId: jobId,
                details: { type: job.type, result: result.status },
            });
        }
        catch (e) { }
        if (userId && !job.isVerification) {
            try {
                const cost = 1.0;
                await this.billingService.consumeCredits(job.projectId, userId, job.organizationId, cost, 'JOB_COMPLETE', `JOB_FINISH_${jobId}`);
            }
            catch (e) {
                this.logger.error(`Credits deduction failed: ${e.message}`);
            }
        }
        if (userId && job.type === 'SHOT_RENDER') {
            try {
                await this.copyrightService.registerAsset(userId, 'shot_render', `job-${job.id}-hash`);
            }
            catch (e) { }
        }
        if (job.taskId) {
            await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
        }
        this.eventEmitter.emit(`job.${result.status === 'SUCCEEDED' ? 'succeeded' : 'failed'}`, {
            jobId,
            type: job.type,
            projectId: job.projectId,
        });
        return updatedJob;
    }
    async completeJob(jobId, workerId, params) {
        const workerNode = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!workerNode)
            throw new common_1.ForbiddenException(`Worker ${workerId} not found`);
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
        });
        if (!job)
            throw new common_1.NotFoundException(`Job ${jobId} not found`);
        if (job.workerId !== workerNode.id)
            throw new common_1.ForbiddenException(`Job ownership mismatch`);
        return this.reportJobResult(jobId, params, undefined);
    }
    async updateTaskStatusIfAllJobsCompleted(taskId) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { jobs: true },
        });
        if (!task || task.jobs.length === 0)
            return;
        const allSucceeded = task.jobs.every((job) => job.status === 'SUCCEEDED');
        const hasFailed = task.jobs.some((job) => job.status === 'FAILED');
        const hasRetrying = task.jobs.some((job) => job.status === 'RETRYING');
        const hasPendingOrRunning = task.jobs.some((job) => job.status === 'PENDING' || job.status === 'RUNNING');
        if (allSucceeded) {
            await this.taskService.updateStatus(taskId, 'SUCCEEDED');
        }
        else if (hasFailed && !hasRetrying && !hasPendingOrRunning) {
            await this.taskService.updateStatus(taskId, 'FAILED');
        }
    }
    async markJobFailedAndMaybeRetry(jobId, errorMessage, userId) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: job_service_queries_1.SHOT_JOB_WITH_HIERARCHY,
        });
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        const computation = (0, job_retry_1.computeNextRetry)(job);
        await this.prisma.$transaction(async (tx) => {
            return await (0, job_retry_1.markRetryOrFail)(tx, job, { errorMessage });
        });
        try {
            await this.auditLogService.record({
                userId,
                action: computation.shouldFail ? audit_constants_1.AuditActions.JOB_FAILED : audit_constants_1.AuditActions.JOB_RETRYING,
                resourceType: 'job',
                resourceId: job.id,
                details: { error: errorMessage, retryCount: job.retryCount },
            });
        }
        catch (e) { }
        if (job.taskId) {
            await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
        }
        return this.prisma.shotJob.findUnique({ where: { id: jobId } });
    }
};
exports.JobUpdateOpsService = JobUpdateOpsService;
exports.JobUpdateOpsService = JobUpdateOpsService = JobUpdateOpsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => task_service_1.TaskService))),
    __param(3, (0, common_1.Inject)(billing_service_1.BillingService)),
    __param(4, (0, common_1.Inject)(copyright_service_1.CopyrightService)),
    __param(5, (0, common_1.Inject)(event_emitter_1.EventEmitter2)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        task_service_1.TaskService,
        billing_service_1.BillingService,
        copyright_service_1.CopyrightService,
        event_emitter_1.EventEmitter2])
], JobUpdateOpsService);
//# sourceMappingURL=job-update-ops.service.js.map