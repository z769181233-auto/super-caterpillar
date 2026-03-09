import { Injectable, Inject, forwardRef, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TaskService } from '../task/task.service';
import { BillingService } from '../billing/billing.service';
import { CopyrightService } from '../copyright/copyright.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditActions } from '../audit/audit.constants';
import { JobStatus, JobType } from 'database';
import { markRetryOrFail, computeNextRetry } from './job.retry';
import { ShotJobWithShotHierarchy } from './job.service.types';
import { SHOT_JOB_WITH_HIERARCHY } from './job.service.queries';

@Injectable()
export class JobUpdateOpsService {
    private readonly logger = new Logger(JobUpdateOpsService.name);

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
        @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService,
        @Inject(BillingService) private readonly billingService: BillingService,
        @Inject(CopyrightService) private readonly copyrightService: CopyrightService,
        @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2
    ) { }

    /**
     * Stage 2: Worker Acknowledge Job
     */
    async ackJob(jobId: string, workerId: string) {
        const workerNode = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!workerNode) throw new ForbiddenException(`Worker ${workerId} not found`);

        const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
        if (!job) throw new NotFoundException(`Job ${jobId} not found`);

        if (job.workerId !== workerNode.id) throw new ForbiddenException(`Job ownership mismatch`);
        if (job.status === 'RUNNING') return { status: 'RUNNING', idempotent: true };
        if (job.status !== 'DISPATCHED') throw new BadRequestException(`Cannot ack job in status ${job.status}`);

        await this.prisma.shotJob.update({
            where: { id: jobId },
            data: { status: 'RUNNING' as any },
        });

        return { status: 'RUNNING', idempotent: false };
    }

    /**
     * reportJobResult: The complex logic for handling job completion
     */
    async reportJobResult(
        jobId: string,
        result: { status: 'SUCCEEDED' | 'FAILED'; result?: any; errorMessage?: string },
        userId?: string
    ) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
        });
        if (!job) throw new NotFoundException(`Job ${jobId} not found`);

        const updatedJob = await this.prisma.shotJob.update({
            where: { id: jobId },
            data: {
                status: result.status as any,
                result: result.result,
                lastError: result.errorMessage,
                updatedAt: new Date(),
            },
        });

        // 1. Audit Log
        try {
            await this.auditLogService.record({
                userId,
                action: result.status === 'SUCCEEDED' ? AuditActions.JOB_SUCCEEDED : AuditActions.JOB_FAILED,
                resourceType: 'job',
                resourceId: jobId,
                details: { type: job.type, result: result.status },
            });
        } catch (e) { }

        // 2. Billing (only for real jobs, not verification)
        if (userId && !job.isVerification) {
            try {
                const cost = 1.0;
                await this.billingService.consumeCredits(
                    job.projectId,
                    userId,
                    job.organizationId,
                    cost,
                    'JOB_COMPLETE' as any,
                    `JOB_FINISH_${jobId}`
                );
            } catch (e) {
                this.logger.error(`Credits deduction failed: ${e.message}`);
            }
        }

        // 3. Copyright registration for renders
        if (userId && job.type === 'SHOT_RENDER') {
            try {
                await this.copyrightService.registerAsset(userId, 'shot_render', `job-${job.id}-hash`);
            } catch (e) { }
        }

        // 4. DAG Aggregation
        if (job.taskId) {
            await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
        }

        // 5. Emit Event for Orchestrator
        this.eventEmitter.emit(`job.${result.status === 'SUCCEEDED' ? 'succeeded' : 'failed'}`, {
            jobId,
            type: job.type,
            projectId: job.projectId,
        });

        return updatedJob;
    }

    /**
   * Stage 2: Worker Complete Job (RUNNING -> SUCCEEDED | FAILED)
   */
    async completeJob(
        jobId: string,
        workerId: string,
        params: {
            status: 'SUCCEEDED' | 'FAILED';
            result?: any;
            errorMessage?: string;
        }
    ) {
        // 1. Resolve Worker UUID
        const workerNode = await this.prisma.workerNode.findUnique({
            where: { workerId },
        });
        if (!workerNode) throw new ForbiddenException(`Worker ${workerId} not found`);

        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
        });
        if (!job) throw new NotFoundException(`Job ${jobId} not found`);

        // 2. Strict Ownership Check
        if (job.workerId !== workerNode.id) throw new ForbiddenException(`Job ownership mismatch`);

        // 3. Delegate to reportJobResult
        return this.reportJobResult(jobId, params, undefined);
    }

    async updateTaskStatusIfAllJobsCompleted(taskId: string) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { jobs: true },
        });

        if (!task || task.jobs.length === 0) return;

        const allSucceeded = task.jobs.every((job: any) => job.status === 'SUCCEEDED');
        const hasFailed = task.jobs.some((job: any) => job.status === 'FAILED');
        const hasRetrying = task.jobs.some((job: any) => job.status === 'RETRYING');
        const hasPendingOrRunning = task.jobs.some(
            (job: any) => job.status === 'PENDING' || job.status === 'RUNNING'
        );

        if (allSucceeded) {
            await this.taskService.updateStatus(taskId, 'SUCCEEDED' as any);
        } else if (hasFailed && !hasRetrying && !hasPendingOrRunning) {
            await this.taskService.updateStatus(taskId, 'FAILED' as any);
        }
    }

    /**
     * markJobFailedAndMaybeRetry: Logical extraction for Orchestrator and others
     */
    async markJobFailedAndMaybeRetry(
        jobId: string,
        errorMessage?: string,
        userId?: string
    ) {
        const job = await this.prisma.shotJob.findUnique({
            where: { id: jobId },
            include: SHOT_JOB_WITH_HIERARCHY,
        }) as ShotJobWithShotHierarchy;

        if (!job) throw new NotFoundException('Job not found');

        // Logic from original job.service.ts
        const computation = computeNextRetry(job);

        await this.prisma.$transaction(async (tx) => {
            return await markRetryOrFail(tx, job, { errorMessage });
        });

        // Audit Log
        try {
            await this.auditLogService.record({
                userId,
                action: computation.shouldFail ? AuditActions.JOB_FAILED : AuditActions.JOB_RETRYING,
                resourceType: 'job',
                resourceId: job.id,
                details: { error: errorMessage, retryCount: job.retryCount },
            });
        } catch (e) { }

        if (job.taskId) {
            await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
        }

        return this.prisma.shotJob.findUnique({ where: { id: jobId } });
    }
}
