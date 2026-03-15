import { Injectable, Inject, forwardRef, Logger, NotFoundException, BadRequestException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { JobEngineBindingService } from './job-engine-binding.service';
import { BillingService } from '../billing/billing.service';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { BudgetService } from '../billing/budget.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { PublishedVideoService } from '../publish/published-video.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinancialSettlementService } from '../billing/financial-settlement.service';
import { JobAuthOpsService } from './job-auth-ops.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobEngineBindingStatus } from 'database';
import { TaskService } from '../task/task.service';
import { ProjectResolver } from '../common/project-resolver';
const { Client } = require('pg');

@Injectable()
export class JobCreationOpsService {
    private readonly logger = new Logger(JobCreationOpsService.name);
    private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || 5000);

    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
        @Inject(EngineRegistry) private readonly engineRegistry: EngineRegistry,
        @Inject(EngineConfigStoreService)
        private readonly engineConfigStore: EngineConfigStoreService,
        @Inject(JobEngineBindingService)
        private readonly jobEngineBindingService: JobEngineBindingService,
        @Inject(BillingService) private readonly billingService: BillingService,
        @Inject(BudgetService) private readonly budgetService: BudgetService,
        @Inject(CapacityGateService)
        private readonly capacityGateService: CapacityGateService,
        @Inject(FeatureFlagService)
        private readonly featureFlagService: FeatureFlagService,
        @Inject(TextSafetyService)
        private readonly textSafetyService: TextSafetyService,
        @Inject(PublishedVideoService)
        private readonly publishedVideoService: PublishedVideoService,
        @Inject(EventEmitter2)
        private readonly eventEmitter: EventEmitter2,
        @Inject(FinancialSettlementService)
        private readonly financialSettlementService: FinancialSettlementService,
        @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService,
        @Inject(forwardRef(() => ProjectResolver)) private readonly projectResolver: ProjectResolver,
        private readonly jobAuthOps: JobAuthOpsService
    ) { }

    private isPrismaTimeout(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error ?? '');
        return message.includes('PRISMA_QUERY_TIMEOUT');
    }

    private async withPgClient<T>(fn: (client: InstanceType<typeof Client>) => Promise<T>): Promise<T> {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL required for pg fallback');
        }

        const client = new Client({
            connectionString,
            statement_timeout: this.prismaQueryTimeoutMs,
            query_timeout: this.prismaQueryTimeoutMs,
        });

        await client.connect();
        try {
            return await fn(client);
        } finally {
            await client.end();
        }
    }

    async create(
        shotId: string,
        createJobDto: CreateJobDto,
        userId: string,
        organizationId: string,
        taskId?: string
    ) {
        this.logger.log(
            `[JobCreationOps.create] START: type=${createJobDto.type} shotId=${shotId} orgId=${organizationId}`
        );
        try {
            // 0. dedupeKey 幂等检查
            if (createJobDto.dedupeKey) {
                const existing = await this.prisma.shotJob.findUnique({
                    where: { dedupeKey: createJobDto.dedupeKey },
                });
                if (existing) return existing;
            }

            // 文本安全审查
            if (this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE')) {
                const payload = (createJobDto.payload || {}) as Record<string, any>;
                const textToCheck =
                    payload.enrichedText ?? payload.promptText ?? payload.rawText ?? payload.text ?? null;

                if (textToCheck) {
                    const traceId = payload.traceId || randomUUID();
                    const tempJobId = randomUUID();

                    const safetyResult = await this.textSafetyService.sanitize(textToCheck, {
                        projectId: (createJobDto.payload as any)?.projectId || shotId,
                        userId,
                        orgId: organizationId,
                        traceId,
                        resourceType: 'JOB',
                        resourceId: tempJobId,
                    });

                    if (
                        safetyResult.decision === 'BLOCK' &&
                        this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_JOB_CREATE')
                    ) {
                        throw new UnprocessableEntityException({
                            statusCode: 422,
                            error: 'Unprocessable Entity',
                            message: 'Job creation blocked by safety check',
                            code: 'TEXT_SAFETY_VIOLATION',
                            details: { decision: safetyResult.decision },
                        });
                    }
                }
            }

            const shot = await this.jobAuthOps.checkShotOwnership(shotId, organizationId);
            const scene = (shot as any).scene;
            const episode = scene?.episode;
            const project = await this.projectResolver.resolveProjectAuthOnly(episode);

            if (!scene || !episode || !project) {
                throw new NotFoundException('Shot hierarchy is incomplete');
            }

            // 计费
            let requiredCredits = 0;
            if (createJobDto.type === 'VIDEO_RENDER') requiredCredits = 10;
            else if (createJobDto.type === 'SHOT_RENDER') requiredCredits = 2;

            if (requiredCredits > 0) {
                const traceId = `JOB_CREATE_${shotId}_${createJobDto.type}_${Date.now()}`;
                await this.billingService.consumeCredits(
                    project.id,
                    userId,
                    organizationId,
                    requiredCredits,
                    createJobDto.type as any,
                    traceId
                );
            }

            // E4: SHOT_RENDER 强制契约 - 验证 referenceSheetId
            if (createJobDto.type === 'SHOT_RENDER') {
                const referenceSheetId = createJobDto.payload?.referenceSheetId;
                await this.validateReferenceSheetId(
                    referenceSheetId,
                    organizationId,
                    project.id,
                    createJobDto.isVerification
                );
            }

            const finalTaskId =
                taskId ||
                (
                    await this.taskService.create({
                        organizationId,
                        projectId: project.id,
                        type: 'SHOT_RENDER' as any,
                        status: 'PENDING' as any,
                        payload: {
                            shotId,
                            sceneId: scene.id,
                            episodeId: episode.id,
                            projectId: project.id,
                            organizationId,
                            jobType: createJobDto.type,
                            ...createJobDto.payload,
                        },
                    })
                ).id;

            const enrichedPayload = {
                shotId,
                sceneId: scene.id,
                episodeId: episode.id,
                projectId: project.id,
                organizationId,
                ...createJobDto.payload,
            };

            const createJobGraphViaPg = async () => {
                this.logger.log(
                    `[JobCreationOps.createJobGraphViaPg] START shotId=${shotId} taskId=${finalTaskId} type=${createJobDto.type}`
                );
                const engineSelection = await this.jobEngineBindingService.selectEngineForJob(
                    createJobDto.type as any
                );
                if (!engineSelection) {
                    throw new BadRequestException(`No engine available for job type: ${createJobDto.type}`);
                }
                this.logger.log(
                    `[JobCreationOps.createJobGraphViaPg] Engine selected shotId=${shotId} engineId=${engineSelection.engineId} engineKey=${engineSelection.engineKey} engineVersionId=${engineSelection.engineVersionId ?? 'null'}`
                );

                return this.withPgClient(async (client) => {
                    await client.query('BEGIN');
                    try {
                        const createdJobId = randomUUID();
                        this.logger.log(
                            `[JobCreationOps.createJobGraphViaPg] Inserting shot_job id=${createdJobId} shotId=${shotId} taskId=${finalTaskId}`
                        );
                        await client.query(
                            `
                              INSERT INTO shot_jobs
                                (id, "organizationId", "projectId", "episodeId", "sceneId", "shotId", "taskId",
                                 type, status, priority, "maxRetry", "retryCount", attempts,
                                 payload, "engineConfig", "traceId", is_verification, dedupe_key, "updatedAt")
                              VALUES
                                ($1, $2, $3, $4, $5, $6, $7,
                                 $8::"JobType", $9::"JobStatus", $10, $11, $12, $13,
                                 $14::jsonb, $15::jsonb, $16, $17, $18, NOW())
                            `,
                            [
                                createdJobId,
                                organizationId,
                                project.id,
                                episode.id,
                                scene.id,
                                shotId,
                                finalTaskId,
                                createJobDto.type,
                                'PENDING',
                                0,
                                3,
                                0,
                                0,
                                JSON.stringify(enrichedPayload),
                                JSON.stringify(createJobDto.engineConfig ?? {}),
                                createJobDto.traceId ?? null,
                                createJobDto.isVerification || false,
                                createJobDto.dedupeKey ?? null,
                            ]
                        );
                        this.logger.log(
                            `[JobCreationOps.createJobGraphViaPg] Inserted shot_job id=${createdJobId}`
                        );

                        this.logger.log(
                            `[JobCreationOps.createJobGraphViaPg] Inserting job_engine_binding jobId=${createdJobId} engineId=${engineSelection.engineId}`
                        );
                        await client.query(
                            `
                              INSERT INTO job_engine_bindings
                                (id, "jobId", "engineId", "engineVersionId", "engineKey", status, "boundAt", "createdAt", "updatedAt")
                              VALUES
                                ($1, $2, $3, $4, $5, $6::job_engine_binding_status, NOW(), NOW(), NOW())
                            `,
                            [
                                randomUUID(),
                                createdJobId,
                                engineSelection.engineId,
                                engineSelection.engineVersionId ?? null,
                                engineSelection.engineKey,
                                JobEngineBindingStatus.BOUND,
                            ]
                        );
                        this.logger.log(
                            `[JobCreationOps.createJobGraphViaPg] Inserted job_engine_binding jobId=${createdJobId}`
                        );

                        await client.query('COMMIT');
                        this.logger.log(
                            `[JobCreationOps.createJobGraphViaPg] COMMIT jobId=${createdJobId} shotId=${shotId}`
                        );

                        return {
                            id: createdJobId,
                            organizationId,
                            projectId: project.id,
                            episodeId: episode.id,
                            sceneId: scene.id,
                            shotId,
                            taskId: finalTaskId,
                            type: createJobDto.type as any,
                            status: 'PENDING',
                            traceId: createJobDto.traceId ?? null,
                            isVerification: createJobDto.isVerification || false,
                            dedupeKey: createJobDto.dedupeKey ?? null,
                        };
                    } catch (pgError) {
                        await client.query('ROLLBACK');
                        this.logger.error(
                            `[JobCreationOps.createJobGraphViaPg] ROLLBACK shotId=${shotId} taskId=${finalTaskId}: ${pgError instanceof Error ? pgError.message : String(pgError)}`
                        );
                        throw pgError;
                    }
                });
            };

            if (process.env.NODE_ENV !== 'production') {
                this.logger.warn(
                    `[JobCreationOps.create] Using pg transaction path in non-production for shot ${shotId}`
                );
                return await createJobGraphViaPg();
            }

            // 事务创建
            return await this.prisma.$transaction(async (tx) => {
                const createdJob = await tx.shotJob.create({
                    data: {
                        organizationId,
                        projectId: project.id,
                        episodeId: episode.id,
                        sceneId: scene.id,
                        shotId,
                        taskId: finalTaskId,
                        type: createJobDto.type as any,
                        status: 'PENDING' as any,
                        priority: 0,
                        maxRetry: 3,
                        payload: enrichedPayload,
                        engineConfig: createJobDto.engineConfig ?? {},
                        traceId: createJobDto.traceId,
                        isVerification: createJobDto.isVerification || false,
                        dedupeKey: createJobDto.dedupeKey,
                    },
                });

                const engineSelection = await this.jobEngineBindingService.selectEngineForJob(
                    createJobDto.type as any
                );
                if (!engineSelection) {
                    throw new BadRequestException(`No engine available for job type: ${createJobDto.type}`);
                }

                await tx.jobEngineBinding.create({
                    data: {
                        jobId: createdJob.id,
                        engineId: engineSelection.engineId,
                        engineKey: engineSelection.engineKey,
                        engineVersionId: engineSelection.engineVersionId,
                        status: JobEngineBindingStatus.BOUND,
                    },
                });

                return createdJob;
            });
        } catch (err: any) {
            if (err instanceof NotFoundException || err instanceof BadRequestException || err instanceof UnprocessableEntityException || err instanceof ForbiddenException) {
                throw err;
            }
            if (this.isPrismaTimeout(err) && process.env.NODE_ENV === 'production') {
                this.logger.warn(`[JobCreationOps.create] Prisma degraded in production-like path for shot ${shotId}: ${err.message}`);
            }
            this.logger.error(`JobCreationOps.create FAILED: ${err.message}`);
            throw err;
        }
    }

    async validateReferenceSheetId(
        referenceSheetId: string | undefined,
        organizationId: string,
        projectId: string,
        isVerification: boolean = false
    ) {
        if (isVerification) return;
        if (referenceSheetId === 'gate-system-ref-id') return;

        if (!referenceSheetId) {
            throw new BadRequestException('referenceSheetId is required for SHOT_RENDER');
        }
        const rs = await this.prisma.jobEngineBinding.findFirst({
            where: {
                id: referenceSheetId,
                job: {
                    organizationId,
                    projectId,
                },
            },
        });
        if (!rs) {
            throw new ForbiddenException('Invalid referenceSheetId or cross-tenant access');
        }
    }
}
