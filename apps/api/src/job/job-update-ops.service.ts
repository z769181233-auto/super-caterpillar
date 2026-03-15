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

const { Client } = require('pg');

@Injectable()
export class JobUpdateOpsService {
    private readonly logger = new Logger(JobUpdateOpsService.name);
    private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
        @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService,
        @Inject(BillingService) private readonly billingService: BillingService,
        @Inject(CopyrightService) private readonly copyrightService: CopyrightService,
        @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2
    ) { }

    private shouldFallbackToPg(error: any): boolean {
        const message = String(error?.message || '');
        return (
            message.includes('PRISMA_QUERY_TIMEOUT') ||
            message.includes('startup connect exceeded') ||
            message.includes("Can't reach database server") ||
            message.includes('P1001')
        );
    }

    private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            connectionTimeoutMillis: this.prismaQueryTimeoutMs,
            query_timeout: this.prismaQueryTimeoutMs,
        });

        await client.connect();
        try {
            return await fn(client);
        } finally {
            await client.end().catch(() => undefined);
        }
    }

    /**
     * Stage 2: Worker Acknowledge Job
     */
    async ackJob(jobId: string, workerId: string) {
        try {
            const workerNode = await this.prisma.workerNode.findUnique({
                where: { workerId },
            });
            if (!workerNode) throw new ForbiddenException(`Worker ${workerId} not found`);

            const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
            if (!job) throw new NotFoundException(`Job ${jobId} not found`);

            if (job.workerId !== workerNode.id) throw new ForbiddenException(`Job ownership mismatch`);
            if (job.status === 'RUNNING' || job.status === 'SUCCEEDED') {
                this.logger.log(`[JOB_ACK_IDEMPOTENT] Job ${jobId} already in status ${job.status}, skipping ack.`);
                return { status: job.status, idempotent: true };
            }
            if (job.status !== 'DISPATCHED') throw new BadRequestException(`Cannot ack job in status ${job.status}`);

            await this.prisma.shotJob.update({
                where: { id: jobId },
                data: { status: 'RUNNING' as any },
            });

            return { status: 'RUNNING', idempotent: false };
        } catch (error: any) {
            if (
                error instanceof ForbiddenException ||
                error instanceof NotFoundException ||
                error instanceof BadRequestException ||
                !this.shouldFallbackToPg(error)
            ) {
                throw error;
            }
            this.logger.warn(
                `[JobUpdateOpsService] Prisma ackJob degraded for ${jobId}/${workerId}, using pg fallback: ${error.message}`
            );
            return this.ackJobViaPg(jobId, workerId);
        }
    }

    private async ackJobViaPg(jobId: string, workerId: string) {
        return this.withPgClient(async (client) => {
            await client.query('BEGIN');
            try {
                const workerResult = await client.query(
                    `SELECT id FROM worker_nodes WHERE "workerId" = $1 LIMIT 1`,
                    [workerId]
                );
                const workerNode = workerResult.rows[0];
                if (!workerNode) {
                    throw new ForbiddenException(`Worker ${workerId} not found`);
                }

                const jobResult = await client.query(
                    `SELECT id, status, "workerId" FROM shot_jobs WHERE id = $1 LIMIT 1`,
                    [jobId]
                );
                const job = jobResult.rows[0];
                if (!job) {
                    throw new NotFoundException(`Job ${jobId} not found`);
                }

                if (job.workerId !== workerNode.id) {
                    throw new ForbiddenException(`Job ownership mismatch`);
                }

                if (job.status === 'RUNNING' || job.status === 'SUCCEEDED') {
                    await client.query('COMMIT');
                    return { status: job.status, idempotent: true };
                }

                if (job.status !== 'DISPATCHED') {
                    throw new BadRequestException(`Cannot ack job in status ${job.status}`);
                }

                await client.query(
                    `UPDATE shot_jobs SET status = 'RUNNING', "updatedAt" = NOW() WHERE id = $1`,
                    [jobId]
                );
                await client.query('COMMIT');
                return { status: 'RUNNING', idempotent: false };
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                throw error;
            }
        });
    }

    /**
     * reportJobResult: The complex logic for handling job completion
     */
    async reportJobResult(
        jobId: string,
        result: { status: 'SUCCEEDED' | 'FAILED'; result?: any; errorMessage?: string },
        userId?: string,
        source: string = 'unknown'
    ) {
        let job: any;
        let updatedJob: any;
        let degradedToPg = false;

        try {
            job = await this.prisma.shotJob.findUnique({
                where: { id: jobId },
            });
            if (!job) throw new NotFoundException(`Job ${jobId} not found`);

            const isIdempotent = job.status === 'SUCCEEDED' && result.status === 'SUCCEEDED';

            this.logger.log(
                `[JOB_RESULT_REPORT] jobId=${jobId} type=${job.type} oldStatus=${job.status} newStatus=${result.status} source=${source} idempotentSkip=${isIdempotent}`
            );

            if (isIdempotent) {
                return job;
            }

            updatedJob = await this.prisma.shotJob.update({
                where: { id: jobId },
                data: {
                    status: result.status as any,
                    result: result.result,
                    lastError: result.errorMessage,
                    updatedAt: new Date(),
                },
            });
        } catch (error: any) {
            if (
                error instanceof NotFoundException ||
                !this.shouldFallbackToPg(error)
            ) {
                throw error;
            }

            this.logger.warn(
                `[JobUpdateOpsService] Prisma reportJobResult degraded for ${jobId}, using pg fallback: ${error.message}`
            );
            const fallback = await this.reportJobResultViaPg(jobId, result);
            job = fallback.job;
            updatedJob = fallback.updatedJob;
            degradedToPg = true;
        }

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
            try {
                await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
            } catch (error: any) {
                if (!degradedToPg || !this.shouldFallbackToPg(error)) {
                    throw error;
                }
                this.logger.warn(
                    `[JobUpdateOpsService] Skipping task aggregation for ${jobId} during Prisma degradation: ${error.message}`
                );
            }
        }

        // 5. Emit Event for Orchestrator
        this.eventEmitter.emit(`job.${result.status === 'SUCCEEDED' ? 'succeeded' : 'failed'}`, {
            id: jobId,
            jobId,
            type: job.type,
            projectId: job.projectId,
        });

        return updatedJob;
    }

    private async reportJobResultViaPg(
        jobId: string,
        result: { status: 'SUCCEEDED' | 'FAILED'; result?: any; errorMessage?: string }
    ) {
        return this.withPgClient(async (client) => {
            await client.query('BEGIN');
            try {
                const jobResult = await client.query(
                    `SELECT id, status, type, "taskId", "projectId", "organizationId", "is_verification"
                     FROM shot_jobs
                     WHERE id = $1
                     LIMIT 1`,
                    [jobId]
                );
                const job = jobResult.rows[0];
                if (!job) {
                    throw new NotFoundException(`Job ${jobId} not found`);
                }

                const isIdempotent = job.status === 'SUCCEEDED' && result.status === 'SUCCEEDED';
                this.logger.log(
                    `[JOB_RESULT_REPORT] jobId=${jobId} type=${job.type} oldStatus=${job.status} newStatus=${result.status} source=pg-fallback idempotentSkip=${isIdempotent}`
                );

                if (isIdempotent) {
                    await client.query('COMMIT');
                    return { job, updatedJob: job };
                }

                const updateResult = await client.query(
                    `UPDATE shot_jobs
                     SET status = $2,
                         result = $3,
                         "lastError" = $4,
                         "updatedAt" = NOW()
                     WHERE id = $1
                     RETURNING id, status, type, "taskId", "projectId", "organizationId", "is_verification", result, "lastError", "updatedAt"`,
                    [jobId, result.status, result.result ?? null, result.errorMessage ?? null]
                );

                await client.query('COMMIT');
                return {
                    job,
                    updatedJob: updateResult.rows[0],
                };
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                throw error;
            }
        });
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
        return this.reportJobResult(jobId, params, undefined, 'worker-complete');
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
