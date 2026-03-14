import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  Inject,
  forwardRef,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getTraceId } from '@scu/observability';
import { CapacityErrorCode, CapacityExceededException } from '../common/errors/capacity-errors';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActions } from '../audit/audit.constants';
import { ProjectResolver } from '../common/project-resolver';
import { CreateJobDto } from './dto/create-job.dto';
import { EngineRegistry } from '../engine/engine-registry.service';
import { QualityScoreService } from '../quality/quality-score.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { JobEngineBindingService } from './job-engine-binding.service';
import { BillingService } from '../billing/billing.service';
import { FinancialSettlementService } from '../billing/financial-settlement.service';
import { CopyrightService } from '../copyright/copyright.service';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { BudgetService } from '../billing/budget.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { PublishedVideoService } from '../publish/published-video.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  JobStatus,
  JobType,
  TaskStatus,
  TaskType,
  JobEngineBindingStatus,
  ShotReviewStatus,
  ShotJob,
} from 'database';
import {
  assertTransition,
  isClaimableStatus,
  transitionJobStatus,
  transitionJobStatusAdmin,
} from './job.rules';
import { markRetryOrFail, computeNextRetry } from './job.retry';

// Forwarding types for backward compatibility
export type JobStatusType = JobStatus;
export type JobTypeType = JobType;
export type TaskStatusType = TaskStatus;
export type TaskTypeType = TaskType;
export const JobStatusEnum = JobStatus;
export const JobTypeEnum = JobType;
export const TaskStatusEnum = TaskStatus;
export const TaskTypeEnum = TaskType;

import { JobAuthOpsService } from './job-auth-ops.service';
import { JobCreationOpsService } from './job-creation-ops.service';
import { JobUpdateOpsService } from './job-update-ops.service';
import { ShotJobWithShotHierarchy } from './job.service.types';
import { SHOT_JOB_WITH_HIERARCHY, SHOT_WITH_HIERARCHY } from './job.service.queries';

/**
 * Job Service (Tactical Slimming Facade)
 */

/**
 * Job Service (Tactical Slimming Facade)
 */
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TaskService)) private readonly taskService: TaskService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(EngineRegistry) private readonly engineRegistry: EngineRegistry,
    @Inject(forwardRef(() => QualityScoreService))
    private readonly qualityScoreService: QualityScoreService,
    @Inject(EngineConfigStoreService)
    private readonly engineConfigStore: EngineConfigStoreService,
    @Inject(JobEngineBindingService)
    private readonly jobEngineBindingService: JobEngineBindingService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(CopyrightService)
    private readonly copyrightService: CopyrightService,
    @Inject(CapacityGateService)
    private readonly capacityGateService: CapacityGateService,
    @Inject(FeatureFlagService)
    private readonly featureFlagService: FeatureFlagService,
    @Inject(TextSafetyService)
    private readonly textSafetyService: TextSafetyService,
    @Inject(BudgetService) private readonly budgetService: BudgetService,
    @Inject(PublishedVideoService)
    private readonly publishedVideoService: PublishedVideoService,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,
    @Inject(FinancialSettlementService)
    private readonly financialSettlementService: FinancialSettlementService,
    @Inject(forwardRef(() => ProjectResolver))
    private readonly projectResolver: ProjectResolver,
    private readonly jobAuthOps: JobAuthOpsService,
    private readonly jobCreationOps: JobCreationOpsService,
    private readonly jobUpdateOps: JobUpdateOpsService
  ) { }

  /**
   * Ownership verification delegated to JobAuthOpsService
   */
  async checkShotOwnership(shotId: string, userId: string, organizationId: string) {
    return this.jobAuthOps.checkShotOwnership(shotId, organizationId);
  }

  /**
   * Creation logic delegated to JobCreationOpsService
   */
  async create(
    shotId: string,
    createJobDto: CreateJobDto,
    userId: string,
    organizationId: string,
    taskId?: string
  ) {
    return this.jobCreationOps.create(shotId, createJobDto, userId, organizationId, taskId);
  }

  /**
   * Status updates delegated to JobUpdateOpsService
   */
  async ackJob(jobId: string, workerId: string) {
    return this.jobUpdateOps.ackJob(jobId, workerId);
  }

  /**
   * Result reporting delegated to JobUpdateOpsService
   */
  async reportJobResult(
    jobId: string,
    status: JobStatusType,
    result?: any,
    errorMessage?: string,
    userId?: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string,
    hmacMeta?: { nonce?: string; signature?: string; hmacTimestamp?: string },
    attempts?: number
  ) {
    return this.jobUpdateOps.reportJobResult(jobId, { status: status as any, result, errorMessage }, userId);
  }

  /**
   * markJobFailedAndMaybeRetry facade for backward compatibility
   */
  async markJobFailedAndMaybeRetry(
    jobId: string,
    errorMessage?: string,
    userId?: string
  ) {
    return this.jobUpdateOps.markJobFailedAndMaybeRetry(jobId, errorMessage, userId);
  }

  /**
   * Complete job delegated to JobUpdateOpsService
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
    return this.jobUpdateOps.completeJob(jobId, workerId, params);
  }

  /**
   * Reference verification delegated to JobCreationOpsService
   */
  async validateReferenceSheetId(
    referenceSheetId: string | undefined,
    organizationId: string,
    projectId: string,
    isVerification: boolean = false
  ) {
    return this.jobCreationOps.validateReferenceSheetId(referenceSheetId, organizationId, projectId, isVerification);
  }












  /**
   * 创建小说分析 Job（不需要 shotId）
   * @param createJobDto Job 创建参数
   * @param userId 用户 ID
   * @param organizationId 组织 ID
   * @param taskId Task ID
   * @param apiKeyId API Key ID（可选）
   * @param ip IP 地址（可选）
   * @param userAgent UserAgent（可选）
   */
  async createNovelAnalysisJob(
    createJobDto: CreateJobDto,
    userId: string,
    organizationId: string,
    taskId: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string
  ) {
    // S3-C.2: 提取并保留 payload
    const payload = (createJobDto.payload || {}) as Record<string, any>;

    // P1-3: Inject TraceId from context if not provided
    const traceId =
      createJobDto.traceId || getTraceId() || createJobDto.payload?.traceId || randomUUID();
    let shotId = payload.shotId as string | undefined;
    let episodeId = payload.episodeId as string | undefined;
    let sceneId = payload.sceneId as string | undefined;
    const projectId = payload.projectId as string | undefined;
    const chapterId = payload.chapterId as string | undefined;

    if (!projectId) {
      throw new BadRequestException('projectId is required for novel analysis job');
    }

    // 如果没有提供 shot/scene/episode，则为小说分析创建最小占位结构
    if (!shotId) {
      // Episode（按 chapterId 去重，避免重复创建）
      let episode: any = null;
      if (chapterId) {
        episode = await this.prisma.episode.findUnique({
          where: { chapterId },
        });
      }

      if (!episode) {
        const episodeIndex = (await this.prisma.episode.count({ where: { projectId } })) + 1;
        episode = await this.prisma.episode.create({
          data: {
            projectId,
            seasonId: null as any, // [Audit] Removed Season layer, bypass strict TS
            chapterId: chapterId,
            index: episodeIndex,
            name: `Episode ${episodeIndex}`,
            summary: 'Auto generated for novel analysis',
          },
        });
      }
      episodeId = episode.id;

      // Scene
      const scene = await this.prisma.scene.create({
        data: {
          episodeId: episode.id,
          projectId,
          sceneIndex: 9999,
          title: `Job Placeholder Scene`,
          summary: 'Auto generated for novel analysis',
        },
      });
      sceneId = scene.id;

      // Shot
      const shot = await this.prisma.shot.create({
        data: {
          sceneId: scene.id,
          index: 9999,
          title: `Job Placeholder Shot`,
          description: 'Auto generated for novel analysis',
          type: 'novel_analysis',
          params: {},
          organizationId,
        },
      });
      shotId = shot.id;
    }

    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: {
          include: {
            episode: {
              include: {
                project: true, // V3.0: Direct link
                season: { include: { project: true } },
              },
            },
          },
        },
      },
    });
    const scene = shot?.scene;
    const episode = scene?.episode;
    const project = await this.projectResolver.resolveProjectAuthOnly(episode);
    if (!scene || !episode || !project) {
      throw new NotFoundException('Shot hierarchy is incomplete');
    }

    // Stage3-A: 在事务中创建 Job 并绑定 Engine
    const job = await this.prisma.$transaction(async (tx) => {
      // 1. 创建 Job
      const createdJob = await tx.shotJob.create({
        data: {
          organizationId,
          projectId: project.id,
          episodeId: episode.id ?? episodeId,
          sceneId: scene.id ?? sceneId,
          shotId,
          taskId,
          type: JobTypeEnum.NOVEL_ANALYSIS,
          status: JobStatusEnum.PENDING,
          priority: 0,
          maxRetry: 3,
          retryCount: 0,
          attempts: 0,
          payload: createJobDto.payload ?? {},
          engineConfig: createJobDto.engineConfig ?? {},
          isVerification: createJobDto.isVerification || false,
          traceId,
          dedupeKey: createJobDto.dedupeKey,
        },
      });

      // 2. 绑定 Engine
      const engineSelection = await this.jobEngineBindingService.selectEngineForJob(
        JobTypeEnum.NOVEL_ANALYSIS
      );
      if (!engineSelection) {
        throw new BadRequestException(
          `No engine available for job type: ${JobTypeEnum.NOVEL_ANALYSIS}`
        );
      }

      // 3. 创建 Engine Binding
      await tx.jobEngineBinding.create({
        data: {
          jobId: createdJob.id,
          engineId: engineSelection.engineId,
          engineKey: engineSelection.engineKey,
          engineVersionId: engineSelection.engineVersionId,
          status: JobEngineBindingStatus.BOUND,
          metadata: {
            strategy: 'default',
            jobType: JobTypeEnum.NOVEL_ANALYSIS,
          },
        },
      });

      return createdJob;
    });

    await this.auditLogService.record({
      userId,
      apiKeyId,
      action: AuditActions.JOB_CREATED,
      resourceType: 'job',
      resourceId: job.id,
      ip,
      userAgent,
      details: { type: job.type, taskId: job.taskId },
    });

    return job;
  }

  /**
   * 创建 CE Core Layer Job（Stage13）
   * Stage13-Final: 使用 Pipeline 级 traceId（从 Task 获取）
   * @param params CE Job 创建参数
   * @returns 创建的 Job
   */
  async createCECoreJob(params: {
    projectId: string;
    organizationId: string;
    taskId?: string;
    jobType: JobTypeType;
    payload: any;
    traceId?: string;
    isVerification?: boolean;
    dedupeKey?: string;
    priority?: number;
  }): Promise<any> {
    const {
      projectId,
      organizationId,
      taskId,
      jobType,
      payload,
      isVerification,
      dedupeKey,
      priority,
    } = params;
    let traceId = params.traceId;

    // 0. Guardrails
    if (dedupeKey) {
      const existing = await this.prisma.shotJob.findUnique({
        where: { dedupeKey },
      });
      if (existing) {
        return existing;
      }
    }

    const budgetStatus = await this.budgetService.getBudgetStatus(organizationId, projectId);
    if (budgetStatus.level === 'BLOCK_ALL_CONSUME') {
      throw new BadRequestException(
        `Budget Exceeded: Organization ${organizationId} is blocked due to excessive cost.`
      );
    }

    const capacity = await this.capacityGateService.checkJobCapacity(jobType, organizationId);
    if (!capacity.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: capacity.reason || 'Capacity Exceeded',
          errorCode: capacity.errorCode,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (payload && typeof payload === 'object') {
      payload._metadata = {
        ...payload._metadata,
        pipeline_timeout_ms: 1800000,
        created_at: new Date().toISOString(),
      };
    }

    try {
      if (!traceId && taskId) {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { traceId: true },
        });
        if (task) traceId = task.traceId ?? undefined;
      }

      if (!traceId) traceId = `tr_ce01_${randomUUID()}`;

      let episode = await this.prisma.episode.findFirst({
        where: { projectId },
        orderBy: { index: 'asc' },
      });

      if (!episode) {
        episode = await this.prisma.episode.create({
          data: {
            projectId,
            seasonId: null as any, // [Audit] Removed Season layer
            index: 1,
            name: 'Episode 1',
            summary: 'Auto generated for CE Core Layer',
          },
        });
      }

      let scene = await this.prisma.scene.findFirst({
        where: { episodeId: episode.id },
        orderBy: { sceneIndex: 'asc' },
      });

      if (!scene) {
        scene = await this.prisma.scene.create({
          data: {
            episodeId: episode.id,
            projectId,
            sceneIndex: payload.sceneIndex || 1,
            title: payload.sceneTitle || 'Auto Scene',
            summary: payload.sceneDescription || 'Auto generated for CE Core Layer',
          },
        });
      }

      let shot = await this.prisma.shot.findFirst({
        where: { sceneId: scene.id },
        orderBy: { index: 'asc' },
      });

      if (!shot) {
        shot = await this.prisma.shot.create({
          data: {
            sceneId: scene.id,
            index: 1,
            title: 'Shot 1',
            description: 'Auto generated for CE Core Layer',
            type: 'ce_core',
            params: {},
            organizationId,
          },
        });
      }

      const actualSceneId = payload.sceneId || scene.id;

      const job = await this.prisma.shotJob.create({
        data: {
          organizationId,
          projectId,
          episodeId: episode.id,
          sceneId: actualSceneId,
          shotId: shot.id,
          taskId,
          type: jobType,
          status: JobStatusEnum.PENDING,
          priority: priority ?? 0,
          maxRetry: 3,
          retryCount: 0,
          attempts: 0,
          payload: payload ?? {},
          engineConfig: payload.engineConfig ?? {},
          traceId,
          isVerification: isVerification || false,
          dedupeKey: dedupeKey,
        },
      });

      await this.auditLogService.record({
        action: AuditActions.JOB_CREATED,
        resourceType: 'job',
        resourceId: job.id,
        details: { type: job.type, taskId: job.taskId, jobType },
      });

      return job;
    } catch (error) {
      this.logger.error(
        `[JobService] createCECoreJob FAILED: ${(error as any).message}`,
        (error as any).stack
      );
      throw error;
    }
  }

  /**
   * 创建 CE01 Character Reference Sheet Job（协议化实例化）
   * PHASE 2A.2: 实现零新增表状态下的协议闭环
   */
  async createCharacterReferenceSheetJob(params: {
    characterId: string;
    organizationId: string;
    projectId: string;
    posePreset?: string;
    styleSeed?: string;
    userId: string;
    traceId?: string;
  }): Promise<{
    referenceSheetId: string;
    engineKey: string;
    engineVersion: string;
    fingerprint: string;
  }> {
    const {
      characterId,
      organizationId,
      projectId,
      posePreset = 'front',
      styleSeed = 'default',
      userId,
      traceId,
    } = params;
    const engineKey = 'character_visual';
    const jobType = JobTypeEnum.CE01_REFERENCE_SHEET;

    // 1. 获取母引擎版本（最新激活版）
    const engineConfig = await this.engineConfigStore.resolveEngineConfig(engineKey, 'default');
    const engineVersion = engineConfig?.version || 'default';

    // 2. 计算协议级指纹 (Stable Fingerprint)
    const fingerprint = `fp_ce01_${characterId}_${posePreset}_${styleSeed}_${engineVersion}`;

    // 3. 幂等检查：在现有 JobEngineBinding 中寻找已完成的实例
    // SECURITY: 必须限定 organizationId 和 projectId 作用域，防止跨租户串用
    const existingBinding = await this.prisma.jobEngineBinding.findFirst({
      where: {
        engineKey,
        status: {
          in: [
            JobEngineBindingStatus.BOUND,
            JobEngineBindingStatus.EXECUTING,
            JobEngineBindingStatus.COMPLETED,
          ],
        },
        metadata: {
          path: ['fingerprint'],
          equals: fingerprint,
        },
        job: {
          organizationId,
          projectId,
        },
      },
      include: { engineVersion: true },
    });

    if (existingBinding) {
      this.logger.log(
        `[CE01] Idempotency hit: found existing binding ${existingBinding.id} for fingerprint ${fingerprint}`
      );
      return {
        referenceSheetId: existingBinding.id,
        engineKey: existingBinding.engineKey,
        engineVersion: existingBinding.engineVersion?.versionName || 'default',
        fingerprint,
      };
    }

    // 4. 创建 CE01 Job（复用 ceCoreJob 占位逻辑）
    const job = await this.createCECoreJob({
      projectId,
      organizationId,
      jobType,
      traceId,
      payload: {
        characterId,
        posePreset,
        styleSeed,
        fingerprint,
        traceId,
      },
    });

    // 5. 绑定 Engine 并注入 Fingerprint 到 Metadata
    const binding = await this.prisma.$transaction(async (tx) => {
      let b = await tx.jobEngineBinding.findUnique({ where: { jobId: job.id } });
      if (!b) {
        const engine = await tx.engine.findUnique({ where: { engineKey } });
        if (!engine) throw new BadRequestException(`Mother engine ${engineKey} missing`);

        b = await tx.jobEngineBinding.create({
          data: {
            jobId: job.id,
            engineId: engine.id,
            engineKey,
            status: JobEngineBindingStatus.BOUND,
            metadata: {
              characterId,
              fingerprint,
              posePreset,
              styleSeed,
            },
          },
        });
      } else {
        b = await tx.jobEngineBinding.update({
          where: { id: b.id },
          data: {
            metadata: {
              ...((b.metadata as any) || {}),
              characterId,
              fingerprint,
              posePreset,
              styleSeed,
            },
          },
        });
      }
      return b;
    });

    return {
      referenceSheetId: binding.id,
      engineKey: binding.engineKey,
      engineVersion,
      fingerprint,
    };
  }


  /**
   * 幂等创建 VIDEO_RENDER Job
   * Stage 8: Structure -> Video Trigger
   * @param shotId Shot ID
   * @param frameKeys List of frame storage keys
   * @param traceId Original traceId for lineage
   * @param userId User ID
   * @param organizationId Organization ID
   * @param isVerification 是否为验证任务（默认 false）
   */
  async ensureVideoRenderJob(
    shotId: string,
    frameKeys: string[],
    traceId: string,
    userId: string,
    organizationId: string,
    isVerification: boolean = false
  ): Promise<any> {
    const jobType = JobTypeEnum.VIDEO_RENDER;

    // P1 修复：容量门禁检查移入事务，防止竞态条件
    // 在事务内检查容量，确保检查与创建 job 的原子性
    return this.prisma.$transaction(async (tx) => {
      // 容量门禁检查（在事务内进行，传入 tx 确保使用同一事务）
      const capacityCheck = await this.capacityGateService.checkVideoRenderCapacity(
        organizationId,
        userId,
        tx // 传入事务客户端
      );

      if (!capacityCheck.allowed) {
        throw new CapacityExceededException(
          capacityCheck.errorCode as CapacityErrorCode,
          capacityCheck.currentCount || 0,
          capacityCheck.limit || 0,
          capacityCheck.reason
        );
      }

      // 双重检查：在创建 job 前再次检查容量（防止时间窗口）
      // 注意：这里仍然存在小的时间窗口，但已大大缩小
      // 更严格的方案是使用数据库约束或分布式锁，但会增加复杂度
      // 1. Check existing job (Idempotency)
      const existing = await tx.shotJob.findFirst({
        where: {
          shotId,
          type: jobType,
          status: { notIn: [JobStatusEnum.FAILED] }, // Ignore failed, create new one. CANCELLED doesn't exist in Prisma enum yet
        },
      });

      if (existing) {
        // 商业级防御：避免复用旧的非验证 job，导致永久污染
        if (isVerification && !existing.isVerification) {
          throw new BadRequestException({
            code: 'VIDEO_RENDER_VERIFICATION_MISMATCH',
            message:
              'Existing VIDEO_RENDER job is non-verification but current pipeline requires verification. Refuse to reuse to avoid billing contamination.',
            details: {
              shotId,
              existingJobId: existing.id,
              existingIsVerification: existing.isVerification,
              requiredIsVerification: isVerification,
              traceId,
            },
          });
        }

        this.logger.log(
          `[JobService] ensureVideoRenderJob: Job already exists (${existing.id}), isVerification=${existing.isVerification}, skipping.`
        );
        return existing;
      }

      // 2. Resolve hierarchy for ShotJob requirement
      const shotHierarchy = await tx.shot.findUnique({
        where: { id: shotId },
        include: { scene: { include: { episode: true } } },
      });

      if (!shotHierarchy) throw new NotFoundException('Resource not found');

      // 3. Create Task (Platform Task wrapper)
      const projectId = shotHierarchy.scene.projectId || shotHierarchy.scene.episode?.projectId;

      if (!projectId) throw new BadRequestException('Project ID not found for scene');

      const task = await this.taskService.create({
        organizationId,
        projectId: projectId,
        type: TaskTypeEnum.VIDEO_RENDER,
        status: TaskStatusEnum.PENDING,
        payload: { shotId, jobType, isVerification },
        traceId, // Propagate traceId
      });

      // 4. Create Job
      const job = await tx.shotJob.create({
        data: {
          organizationId,
          projectId: projectId,
          episodeId: shotHierarchy.scene.episodeId,
          sceneId: shotHierarchy.scene.id,
          shotId,
          taskId: task.id,
          type: jobType,
          status: JobStatusEnum.PENDING,
          isVerification: isVerification ?? false, // ✅ 关键修复：写入 isVerification
          payload: {
            shotId, // Explicitly include shotId in payload for Processor
            frameKeys,
            pipelineRunId: traceId, // EXECUTE-3 Fix: Ensure pipelineRunId is present
            fps: 24, // Default FPS
            isVerification, // 便于 Worker 识别
          },
          traceId,
        },
      });

      // 5. Select & Bind Engine (P0-R2 Fix)
      // Must happen in the same transaction to prevent "headless" jobs
      const engineSelection = await this.jobEngineBindingService.selectEngineForJob(jobType);

      if (!engineSelection) {
        // Hard failure if no engine is mapped (config error)
        throw new BadRequestException(`No engine available for job type: ${jobType}`);
      }

      await tx.jobEngineBinding.create({
        data: {
          jobId: job.id,
          engineId: engineSelection.engineId,
          engineKey: engineSelection.engineKey,
          engineVersionId: engineSelection.engineVersionId,
          status: JobEngineBindingStatus.BOUND,
          metadata: {
            strategy: 'default',
            jobType: jobType,
            reason: 'ensureVideoRenderJob',
            isVerification, // 记录验证标记
          },
        },
      });

      this.logger.log(
        `[JobService] ensureVideoRenderJob: Created job ${job.id}, isVerification=${isVerification}, traceId=${traceId}, bound to ${engineSelection.engineKey}`
      );
      return job;
    });
  }

  /**
   * 安全地领取下一个 PENDING Job（使用数据库级别的锁防止竞态）
   * 参考《调度系统设计书_V1.0》第 3.1~3.5 章：事务 + 悲观锁保证一次分配不重复
   *
   * @param workerId Worker ID（用于验证 Worker 存在）
   * @param jobType 可选的 Job 类型过滤
   * @returns 领取到的 Job，如果没有可用的 Job 则返回 null
   */
  async getAndMarkNextPendingJob(workerId: string, jobType?: string): Promise<any | null> {
    // 商业级硬要求：workerId不能为空
    if (!workerId?.trim()) {
      throw new Error('workerId cannot be empty for claim audit');
    }

    // P1-1: 从 SSOT 配置读取限流参数
    const { env: scuEnv } = await import('@scu/config');
    const jobMaxInFlight = (scuEnv as any).jobMaxInFlight || 10;
    const jobLeaseTtlMs = (scuEnv as any).jobLeaseTtlMs || 30000;

    return this.prisma.$transaction(async (tx) => {
      // P1-1: Strict Concurrency - Serialize claims to prevent race conditions
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8472834)`;

      // 1. 验证 Worker 存在且在线
      const worker = await tx.workerNode.findUnique({
        where: { workerId },
      });

      if (!worker) {
        return null;
      }

      // 检查 Worker 是否被禁用
      const caps = worker.capabilities as Record<string, any>;
      if (caps?.disabled === true) {
        return null;
      }

      // P1-1: 增加并发上限校验（限流防线）
      // 统计当前正在执行且租约未过期的任务
      // Use Raw SQL with Tagged Template Literal for safety
      const runningCountResult = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count 
        FROM "shot_jobs" 
        WHERE status = 'RUNNING' 
        AND lease_until > NOW()
      `;
      const runningCount = Number(runningCountResult[0]?.count || 0);

      if (runningCount >= jobMaxInFlight) {
        this.logger.warn(
          `[JobService] Backpressure: concurrency limit reached (${runningCount}/${jobMaxInFlight}). Rejecting claim for workerId=${workerId}`
        );
        return null;
      }

      const supportedEngines = (caps?.supportedEngines as string[]) || [];
      const filterTypes = jobType ? [jobType] : (caps?.supportedJobTypes as string[]) || [];

      // P1-1: 细粒度并发校验
      // 1. 获取候选 Job（带 Engine 绑定信息）
      const candidates = await tx.$queryRaw<any[]>`
        SELECT j.id, j."organizationId", jeb."engineKey"
        FROM "shot_jobs" j
        LEFT JOIN "job_engine_bindings" jeb ON jeb."jobId" = j.id
        WHERE j.status = 'PENDING'
        AND (j.lease_until IS NULL OR j.lease_until < NOW())
        ${filterTypes.length > 0
          ? Prisma.sql`AND j."type"::text IN (${Prisma.join(filterTypes)})`
          : Prisma.empty
        }
        ${supportedEngines.length > 0
          ? Prisma.sql`AND (jeb."engineKey" IS NULL OR jeb."engineKey" IN (${Prisma.join(supportedEngines)}))`
          : Prisma.empty
        }
        ORDER BY j.priority DESC, j."createdAt" ASC
        LIMIT 10
        FOR UPDATE OF j SKIP LOCKED
      `;

      if (candidates.length === 0) {
        return null;
      }

      let selectedJobId: string | null = null;
      let targetOrganizationId: string | null = null;
      let targetEngineKey: string | null = null;

      // 2. 逐个检查候选者的并发限制
      if ((scuEnv as any).concurrencyLimiterEnabled) {
        for (const cand of candidates) {
          const orgId = cand.organizationId;
          const eKey = cand.engineKey;

          // 检查 Tenant 并发
          if (orgId) {
            const tenantRunningResult = await tx.$queryRaw<{ count: bigint }[]>`
              SELECT COUNT(*)::int as count FROM "shot_jobs" 
              WHERE "organizationId" = ${orgId} AND status = 'RUNNING' AND lease_until > NOW()
            `;
            if (Number(tenantRunningResult[0]?.count || 0) >= (scuEnv as any).maxInFlightTenant) {
              continue;
            }
          }

          // 检查 Engine 并发
          if (eKey) {
            const engineLimit = (scuEnv as any).getEngineConcurrency(eKey);
            const engineRunningResult = await tx.$queryRaw<{ count: bigint }[]>`
              SELECT COUNT(*)::int as count FROM "shot_jobs" j
              JOIN "job_engine_bindings" jeb ON jeb."jobId" = j.id
              WHERE jeb."engineKey" = ${eKey} AND j.status = 'RUNNING' AND j.lease_until > NOW()
            `;
            if (Number(engineRunningResult[0]?.count || 0) >= engineLimit) {
              continue;
            }
          }

          // 走到这里说明都过了
          selectedJobId = cand.id;
          targetOrganizationId = orgId;
          targetEngineKey = eKey;
          break;
        }
      } else {
        // 未开启限流，直接取第一个
        selectedJobId = candidates[0].id;
        targetOrganizationId = candidates[0].organizationId;
        targetEngineKey = candidates[0].engineKey;
      }

      if (!selectedJobId) {
        this.logger.debug(
          `[JobService] Candidates found but all hit concurrency limits for worker ${workerId}`
        );
        return null;
      }

      this.logger.log(
        `[JobService] getAndMarkNextPendingJob: workerId=${workerId} running=${runningCount}/${jobMaxInFlight} selectedJobId=${selectedJobId}`
      );

      // 3. 执行原子更新
      const now = new Date();
      const leaseExpiration = new Date(now.getTime() + jobLeaseTtlMs);

      const claimedJobs = await tx.$queryRaw<any[]>`
        UPDATE "shot_jobs"
        SET 
          status = 'RUNNING',
          "workerId" = (SELECT id FROM "worker_nodes" WHERE "workerId" = ${workerId}),
          "locked_by" = ${workerId},
          "lease_until" = ${leaseExpiration},
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
        WHERE id = ${selectedJobId}
        RETURNING *
      `;

      if (claimedJobs.length > 0) {
        this.logger.log(`[JobService] Claimed job ${claimedJobs[0].id} for worker ${workerId}`);
      } else {
        this.logger.log(
          `[JobService] No jobs to claim for worker ${workerId} (types=${filterTypes.length}, query engines=${supportedEngines.length})`
        );
        return null; // Explicitly return null if no jobs are claimed
      }

      const job = claimedJobs[0];

      // 3. 记录日志：包含租约信息
      this.logger.log(
        JSON.stringify({
          event: 'JOB_CLAIMED_SUCCESS_ATOMIC',
          jobId: job.id,
          workerId,
          jobType: job.type,
          attempts: job.attempts,
          leaseUntil: job.leaseUntil,
          timestamp: new Date().toISOString(),
        })
      );

      // 4. 返回完整结构
      return tx.shotJob.findUnique({
        where: { id: job.id },
        include: {
          task: true,
          shot: {
            include: {
              scene: {
                include: {
                  episode: {
                    include: {
                      season: {
                        include: {
                          project: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Worker 回传 Job 执行结果
   * @param jobId Job ID
   * @param status 执行状态（SUCCEEDED 或 FAILED）
   * @param result 执行结果（可选）
   * @param errorMessage 错误信息（可选）
   * @param userId 用户 ID（用于审计日志）
   * @param apiKeyId API Key ID（用于审计日志）
   * @param ip IP 地址（用于审计日志）
   * @param userAgent UserAgent（用于审计日志）
   */




  /**
   * 处理单个 Job（由 Worker 调用）
   * 这个方法会被 JobWorkerService 调用
   */
  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        shot: {
          include: {
            scene: {
              include: { episode: { include: { season: { include: { project: true } } } } },
            },
          },
        },
        task: true,
        worker: true,
        engineBinding: {
          include: {
            engine: true,
          },
        },
      },
    });

    if (!job) return;

    // 如果状态是 PENDING，先转为 RUNNING（虽通常由 Worker 做了，但防个别手动调用）
    if (job.status === JobStatusEnum.PENDING) {
      transitionJobStatus(JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, {
        jobId: job.id,
        jobType: job.type,
        workerId: 'internal-api-worker',
      });
      await this.prisma.shotJob.update({
        where: { id: jobId },
        data: { status: JobStatusEnum.RUNNING },
      });
    } else if (job.status !== JobStatusEnum.RUNNING) {
      // 非 RUNNING/PENDING 状态（如已被取消或已完成），忽略
      return;
    }

    const startTime = Date.now();
    try {
      // 1. 获取 Engine Adapter
      let engineKey = job.engineBinding?.engine?.engineKey;

      // Auto-bind / Fallback for Internal Worker
      if (!engineKey) {
        if (job.type === JobTypeEnum.NOVEL_ANALYSIS) {
          engineKey = 'default_novel_analysis';
        } else if (job.type === JobTypeEnum.VIDEO_RENDER) {
          engineKey = 'default_video_render';
        } else if (job.type === JobTypeEnum.CE06_NOVEL_PARSING) {
          engineKey = 'ce06_novel_parsing';
        }
      }

      if (!engineKey) {
        throw new Error(`No engine bound and no default found for job type: ${job.type} `);
      }

      const adapter = this.engineRegistry.getAdapter(engineKey);
      if (!adapter) {
        throw new Error(`Engine adapter not found for key: ${engineKey} `);
      }

      // 2. 执行任务
      this.logger.log(`[JobService] Executing job ${jobId} with engine ${engineKey} `);

      // 如果 Adapter 需要完整 Payload 或其他数据，它应自行处理或从 Payload 中获取
      const result = await adapter.invoke(job as any);

      // 3. 上报成功
      await this.reportJobResult(
        job.id,
        JobStatusEnum.SUCCEEDED,
        result,
        undefined,
        (job.payload as any)?.userId, // 尝试从 payload 获取上下文
        undefined,
        'internal-api-worker'
      );

      const duration = Date.now() - startTime;
      this.logger.log(`[JobService] Job ${jobId} finished in ${duration} ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[JobService] Job ${jobId} failed in ${duration} ms: ${error.message} `,
        error.stack
      );

      // 4. 上报失败
      await this.reportJobResult(
        job.id,
        JobStatusEnum.FAILED,
        undefined,
        error.message || 'Unknown internal execution error',
        (job.payload as any)?.userId,
        undefined,
        'internal-api-worker'
      );
    }
  }

  async findByShotId(shotId: string, userId: string, organizationId: string) {
    // Studio v0.7: 检查权限（包含组织检查）
    await this.checkShotOwnership(shotId, userId, organizationId);

    return this.prisma.shotJob.findMany({
      where: {
        shotId,
        organizationId, // Studio v0.7: 按组织过滤
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findJobById(id: string, userId: string, organizationId: string) {
    this.logger.log(
      `[DEBUG] findJobById: id = ${id} userId = ${userId} orgId = ${organizationId} `
    );

    const job = (await this.prisma.shotJob.findUnique({
      where: {
        id,
        organizationId, // Studio v0.7: 按组织过滤
      },
      include: {
        task: true,
        shot: {
          include: {
            scene: {
              include: {
                episode: {
                  include: {
                    season: {
                      include: {
                        project: true, // 影视工业标准：通过 Season 关联到 Project
                      },
                    },
                  },
                },
              },
            },
          },
        },
        engineBinding: {
          include: {
            engine: true,
            engineVersion: true,
          },
        },
      },
    })) as ShotJobWithShotHierarchy | null;

    if (!job) {
      this.logger.warn(`[DEBUG] Job not found by findUnique.Check orgId match.`);
      // Debug: Attempt to find without orgId to diagnose
      const jobAnyOrg = await this.prisma.shotJob.findUnique({ where: { id } });
      if (jobAnyOrg) {
        this.logger.warn(
          `[DEBUG] Job FOUND without org filter! Job Org = ${jobAnyOrg.organizationId}, Request Org = ${organizationId} `
        );
      } else {
        this.logger.warn(`[DEBUG] Job strictly NOT FOUND in DB.`);
      }
      throw new NotFoundException('Job not found');
    }

    // Studio v0.7: 检查组织权限
    // 检查组织权限：支持 Season 和 Project 两种结构
    if (job.shot) {
      const episode = job.shot.scene.episode;

      const project = await this.projectResolver.resolveProjectAuthOnly(episode);

      if (!project || project.organizationId !== organizationId) {
        this.logger.warn(
          `[DEBUG] Project Org Mismatch.Proj Org = ${project?.organizationId}, Request Org = ${organizationId}`
        );
        throw new ForbiddenException('Organization mismatch');
      }
    } else {
      // 如果没有关联 Shot，直接检查项目组织 (NOVEL_SCAN_TOC 等任务)
      const project = await this.prisma.project.findUnique({
        where: { id: job.projectId },
        select: { organizationId: true },
      });
      if (!project || project.organizationId !== organizationId) {
        throw new ForbiddenException(
          'You do not have permission to access this job (Project check failed)'
        );
      }
    }

    return job;
  }

  /**
   * 查询 Jobs（运维接口）
   */
  async listJobs(
    userId: string,
    organizationId: string,
    filters: {
      status?: string;
      type?: string;
      shotId?: string;
      projectId?: string;
      engineKey?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const {
      status,
      type,
      shotId,
      projectId,
      engineKey,
      from,
      to,
      page = 1,
      pageSize = 20,
    } = filters;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Studio v0.7: 构建 where 条件，强制按组织过滤
    const where: any = {
      organizationId, // 强制按组织过滤
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (shotId) {
      where.shotId = shotId;
    }

    // 时间范围过滤（按 createdAt）
    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    // 通过 projectId 过滤（需要联表）
    if (projectId) {
      where.shot = {
        scene: {
          episode: {
            season: {
              projectId,
            },
          },
        },
      };
    } else {
      // 如果没有指定 projectId，只返回用户有权限的项目下的 Jobs
      where.shot = {
        scene: {
          episode: {
            season: {
              project: {
                ownerId: userId,
              },
            },
          },
        },
      };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.shotJob.findMany({
        where,
        include: {
          shot: {
            include: {
              scene: {
                include: {
                  episode: {
                    include: {
                      season: {
                        include: {
                          project: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.shotJob.count({ where }),
    ]);

    // S3-C.1: 按 engineKey 筛选（如果指定）
    const filteredJobs = jobs.filter((job: any) => {
      const project = job.shot.scene.episode.season?.project;
      if (!project || project.organizationId !== organizationId) {
        return false;
      }

      // 如果指定了 engineKey，进行筛选
      if (engineKey) {
        const jobEngineKey = this.extractEngineKeyFromJob(job);
        if (jobEngineKey !== engineKey) {
          return false;
        }
      }

      return true;
    });

    // S3-C.1: 为每个 job 提取 engine 信息和质量评分
    const formattedJobs = await Promise.all(
      filteredJobs.map(async (job: any) => {
        const jobEngineKey = this.extractEngineKeyFromJob(job);
        const jobEngineVersion = this.extractEngineVersionFromJob(job);
        const adapter = this.engineRegistry.getAdapter(jobEngineKey);
        const adapterName = adapter?.name || jobEngineKey;

        // 获取 engine 配置以获取 adapterName（如果 adapter 不存在）
        let finalAdapterName = adapterName;
        if (!adapter) {
          const engineConfig = await this.engineConfigStore.findByEngineKey(jobEngineKey);
          if (engineConfig?.adapterName) {
            finalAdapterName = engineConfig.adapterName;
          }
        }

        // 构建质量评分（可选，如果 job 已完成）
        let qualityScore = null;
        if (job.status === 'SUCCEEDED' && job.taskId) {
          try {
            const score = this.qualityScoreService.buildQualityScoreFromJob(
              job,
              adapter,
              job.taskId
            );
            if (score) {
              qualityScore = {
                score: score.quality?.score ?? null,
                confidence: score.quality?.confidence ?? null,
              };
            }
          } catch (error) {
            // 忽略质量评分构建错误
          }
        }

        return {
          id: job.id,
          type: job.type,
          status: job.status,
          priority: job.priority,
          attempts: job.attempts,
          maxRetry: job.maxRetry,
          retryCount: job.retryCount,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          lastError: job.lastError,
          shotId: job.shotId,
          shotTitle: job.shot.title,
          projectName: job.shot.scene.episode.season?.project?.name ?? 'Unknown',
          // S3-C.1: 新增字段
          engineKey: jobEngineKey,
          engineVersion: jobEngineVersion,
          adapterName: finalAdapterName,
          qualityScore,
        };
      })
    );

    return {
      jobs: formattedJobs,
      total: filteredJobs.length,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * S3-C.3: 从 Job 中提取 engineKey（统一方法，供其他服务复用）
   * 优先级：job.payload.engineKey > EngineRegistry.getDefaultEngineKeyForJobType(job.type) > 'default_novel_analysis'
   */
  extractEngineKeyFromJob(job: { type: string; payload?: any }): string {
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.engineKey && typeof payload.engineKey === 'string') {
        return payload.engineKey;
      }
    }

    // 降级：根据 jobType 返回默认引擎
    const jobType = job?.type;
    return this.engineRegistry.getDefaultEngineKeyForJobType(jobType) || 'default_novel_analysis';
  }

  /**
   * S3-C.3: 从 Job 中提取 engineVersion（统一方法，供其他服务复用）
   * 优先级：job.payload.engineVersion > job.engineConfig.versionName > null
   */
  extractEngineVersionFromJob(job: { payload?: any; engineConfig?: any }): string | null {
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.engineVersion && typeof payload.engineVersion === 'string') {
        return payload.engineVersion;
      }
    }

    if (job?.engineConfig && typeof job.engineConfig === 'object') {
      const engineConfig = job.engineConfig as any;
      if (engineConfig.versionName && typeof engineConfig.versionName === 'string') {
        return engineConfig.versionName;
      }
    }

    return null;
  }

  /**
   * S3-C.2: 获取 Engine 质量摘要
   * 查询最近 100 条指定 engineKey 的 Job，计算聚合指标
   * 性能要求：O(1 query)
   */
  async getEngineSummary(
    engineKey: string,
    projectId: string | undefined,
    userId: string,
    organizationId: string
  ): Promise<{
    engineKey: string;
    totalJobs: number;
    avgScore: number | null;
    avgConfidence: number | null;
    successRate: number;
    avgDurationMs: number | null;
    avgCostUsd: number | null;
  }> {
    // 构建 where 条件
    const where: any = {
      organizationId,
    };

    // 如果指定了 projectId，添加项目过滤
    if (projectId) {
      where.shot = {
        scene: {
          episode: {
            season: {
              projectId,
            },
          },
        },
      };
    } else {
      // 如果没有指定 projectId，只返回用户有权限的项目下的 Jobs
      where.shot = {
        scene: {
          episode: {
            season: {
              project: {
                ownerId: userId,
              },
            },
          },
        },
      };
    }

    // 查询最近 100 条 Job（按 engineKey 筛选在内存中进行，因为需要从 payload 提取）
    const jobs = await this.prisma.shotJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000, // 多取一些，因为需要过滤 engineKey
      select: {
        id: true,
        status: true,
        payload: true,
        engineConfig: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 在内存中过滤 engineKey 匹配的 Job
    const filteredJobs = jobs
      .filter((job: any) => {
        const jobEngineKey = this.extractEngineKeyFromJob(job);
        return jobEngineKey === engineKey;
      })
      .slice(0, 100); // 只取前 100 条

    if (filteredJobs.length === 0) {
      return {
        engineKey,
        totalJobs: 0,
        avgScore: null,
        avgConfidence: null,
        successRate: 0,
        avgDurationMs: null,
        avgCostUsd: null,
      };
    }

    // 计算聚合指标
    let totalScore = 0;
    let scoreCount = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    let successCount = 0;
    let totalDurationMs = 0;
    let durationCount = 0;
    let totalCostUsd = 0;
    let costCount = 0;

    for (const job of filteredJobs) {
      // 计算成功率
      if (job.status === JobStatusEnum.SUCCEEDED) {
        successCount++;
      }

      // 提取质量评分
      if (job.payload && typeof job.payload === 'object') {
        const payload = job.payload as any;
        const result = payload.result;
        if (result) {
          // 提取 score
          if (result.quality?.score !== null && result.quality?.score !== undefined) {
            totalScore += result.quality.score;
            scoreCount++;
          }
          // 提取 confidence
          if (result.quality?.confidence !== null && result.quality?.confidence !== undefined) {
            totalConfidence += result.quality.confidence;
            confidenceCount++;
          }
          // 提取 costUsd
          if (result.metrics?.costUsd !== null && result.metrics?.costUsd !== undefined) {
            totalCostUsd += result.metrics.costUsd;
            costCount++;
          }
        }
      }

      // 计算耗时（从 createdAt 到 updatedAt，仅 SUCCEEDED 或 FAILED）
      if (
        (job.status === JobStatusEnum.SUCCEEDED || job.status === JobStatusEnum.FAILED) &&
        job.createdAt &&
        job.updatedAt
      ) {
        const durationMs = job.updatedAt.getTime() - job.createdAt.getTime();
        if (durationMs > 0) {
          totalDurationMs += durationMs;
          durationCount++;
        }
      }
    }

    return {
      engineKey,
      totalJobs: filteredJobs.length,
      avgScore: scoreCount > 0 ? totalScore / scoreCount : null,
      avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : null,
      successRate: filteredJobs.length > 0 ? successCount / filteredJobs.length : 0,
      avgDurationMs: durationCount > 0 ? totalDurationMs / durationCount : null,
      avgCostUsd: costCount > 0 ? totalCostUsd / costCount : null,
    };
  }

  /**
   * 重试 Job
   */
  async retryJob(
    jobId: string,
    userId: string,
    organizationId: string,
    resetAttempts: boolean = false
  ) {
    const job = await this.findJobById(jobId, userId, organizationId);

    if (job.status === JobStatusEnum.RUNNING) {
      throw new ForbiddenException(
        'Cannot retry a running job. Wait for it to finish or cancel it first.'
      );
    }

    if (job.status === JobStatusEnum.SUCCEEDED) {
      throw new ForbiddenException('Cannot retry a succeeded job.');
    }

    // 统一使用 retryCount >= maxRetry 判断（不使用 attempts）
    const nextRetry = resetAttempts ? 0 : job.retryCount + 1;
    if (nextRetry >= job.maxRetry) {
      throw new ForbiddenException('Max retry reached for this job.');
    }

    // 验证状态转换：必须是 RUNNING -> RETRYING 或 FAILED -> RETRYING
    transitionJobStatus(job.status, JobStatusEnum.RETRYING, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.RETRYING,
        attempts: resetAttempts ? 0 : job.attempts,
        retryCount: nextRetry,
        lastError: null,
        workerId: null,
      },
    });
  }

  /**
   * 取消 Job
   */
  async cancelJob(jobId: string, userId: string, organizationId: string) {
    const job = await this.findJobById(jobId, userId, organizationId);

    if (job.status === JobStatusEnum.SUCCEEDED) {
      throw new ForbiddenException('Cannot cancel a succeeded job.');
    }

    // 验证状态转换：允许从 PENDING/DISPATCHED/RUNNING/RETRYING -> FAILED（用户取消，管理性操作）
    transitionJobStatusAdmin(job.status, JobStatusEnum.FAILED, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.FAILED,
        lastError: 'Cancelled by user',
      },
    });
  }

  /**
   * 强制失败 Job
   */
  async forceFailJob(jobId: string, userId: string, organizationId: string, message?: string) {
    const job = await this.findJobById(jobId, userId, organizationId);

    if (job.status === JobStatusEnum.SUCCEEDED || job.status === JobStatusEnum.FAILED) {
      throw new ForbiddenException(`Cannot force fail a job with status: ${job.status} `);
    }

    // 验证状态转换：允许从 PENDING/DISPATCHED/RUNNING/RETRYING -> FAILED（强制失败，管理性操作）
    transitionJobStatusAdmin(job.status, JobStatusEnum.FAILED, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    const errorMessage = message || 'Manually failed by operator';

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.FAILED,
        lastError: errorMessage,
      },
    });
  }

  /**
   * 批量重试
   */
  async batchRetry(
    jobIds: string[],
    userId: string,
    organizationId: string,
    resetAttempts: boolean = false
  ) {
    const results = await Promise.allSettled(
      jobIds.map((jobId: string) => this.retryJob(jobId, userId, organizationId, resetAttempts))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      succeeded,
      failed,
      total: jobIds.length,
    };
  }

  /**
   * 批量取消
   */
  async batchCancel(jobIds: string[], userId: string, organizationId: string) {
    const results = await Promise.allSettled(
      jobIds.map((jobId: string) => this.cancelJob(jobId, userId, organizationId))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      succeeded,
      failed,
      total: jobIds.length,
    };
  }

  /**
   * 批量强制失败
   */
  async batchForceFail(jobIds: string[], userId: string, organizationId: string, message?: string) {
    const results = await Promise.allSettled(
      jobIds.map((jobId) => this.forceFailJob(jobId, userId, organizationId, message))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      succeeded,
      failed,
      total: jobIds.length,
    };
  }

  /**
   * 获取下一条待处理的 DISPATCHED Job（仅 status=DISPATCHED 且已分配给该 Worker）
   * Stage2-A: Worker 只能领取已由 Orchestrator 分配（DISPATCHED）的 Job
   */
  async getNextPendingJobForWorker(workerId: string) {
    const worker = await this.prisma.workerNode.findUnique({ where: { workerId } });
    if (!worker) {
      throw new NotFoundException(`Worker ${workerId} not found`);
    }

    const job = await this.prisma.shotJob.findFirst({
      where: {
        status: JobStatusEnum.DISPATCHED, // Stage2-A: 改为 DISPATCHED
        workerId: worker.id, // Stage2-A: 必须是已分配给该 Worker 的 Job
      },
      orderBy: { createdAt: 'asc' },
    });

    if (process.env.NODE_ENV === 'development') {
      this.logger.log(
        `[DEV][Job] getNextPendingJobForWorker workerId = ${workerId} jobId = ${job ? job.id : 'none'} status = ${job ? job.status : 'none'} `
      );
    }

    return job;
  }

  /**
   * 将 Job 标记为 RUNNING，并绑定 worker
   * Stage2-B: 增加幂等与归属校验
   */
  async markJobRunning(jobId: string, workerId: string) {
    const worker = await this.prisma.workerNode.findUnique({ where: { workerId } });
    if (!worker) {
      throw new NotFoundException(`Worker ${workerId} not found`);
    }

    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: { worker: true },
    });
    if (!job) {
      throw new NotFoundException('Resource not found');
    }

    // Stage2-B: 幂等校验 - 如果已经是 RUNNING 且 workerId 相同，直接返回
    if (job.status === JobStatusEnum.RUNNING) {
      if (job.workerId === worker.id) {
        // 幂等：同一个 Worker 重复调用 start，直接返回当前状态
        return job;
      } else {
        // 不同 Worker 尝试启动已运行的 Job
        throw new BadRequestException({
          code: 'JOB_ALREADY_RUNNING',
          message: `Job ${jobId} is already running by worker ${job.worker?.workerId || job.workerId} `,
          details: {
            jobId,
            currentWorkerId: job.worker?.workerId || job.workerId,
            requestedWorkerId: workerId,
          },
        });
      }
    }

    // Stage2-B: 状态校验 - 必须是 DISPATCHED
    if (job.status !== JobStatusEnum.DISPATCHED) {
      throw new BadRequestException({
        code: 'JOB_STATE_VIOLATION',
        message: `Job ${jobId} is not in DISPATCHED status.Current status: ${job.status} `,
        details: {
          jobId,
          currentStatus: job.status,
          requiredStatus: JobStatusEnum.DISPATCHED,
        },
      });
    }

    // Stage2-B: 归属校验 - job.workerId 必须 === worker.id
    if (job.workerId !== null && job.workerId !== worker.id) {
      throw new BadRequestException({
        code: 'JOB_WORKER_MISMATCH',
        message: `Job ${jobId} is dispatched to a different worker.Current worker: ${job.worker?.workerId || job.workerId}, Requested worker: ${workerId} `,
        details: {
          jobId,
          currentWorkerId: job.worker?.workerId || job.workerId,
          requestedWorkerId: workerId,
        },
      });
    }

    // P1-B CostGuard: 启动前二次检查余额 (出口门禁)
    const creditsObj = await this.billingService.getCredits('system', job.organizationId);
    const credits = creditsObj.remaining;
    if (credits <= 0) {
      this.logger.warn(`Job ${jobId} blocked at startup: Insufficient credits (${credits})`);

      // 记录硬拦截审计
      await this.auditLogService
        .record({
          userId: (job as any).userId,
          action: 'job.execution.blocked.quota',
          resourceType: 'job',
          resourceId: jobId,
          details: { credits, organizationId: job.organizationId },
        })
        .catch(() => undefined);

      // 断言状态流转合法性 (P1-B Budget Block)
      transitionJobStatus(job.status, JobStatusEnum.FAILED, {
        jobId: job.id,
        jobType: job.type,
      });

      // Note: This update should ideally be part of a transaction if `markJobRunning` is transactional.
      // For now, it's a direct update.
      await this.prisma.shotJob.update({
        where: { id: job.id },
        data: {
          status: JobStatusEnum.FAILED,
          lastError: 'Insufficient credits to start job execution.',
        },
      });

      throw new ForbiddenException({
        code: 'PAYMENT_REQUIRED',
        message: 'Insufficient credits to start job execution.',
        statusCode: 402,
      });
    }

    // 验证状态转换：DISPATCHED -> RUNNING
    transitionJobStatus(JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING, {
      jobId: job.id,
      jobType: job.type as string,
      workerId: worker.id,
    });

    // Stage3-A: 更新 Engine 绑定状态为 EXECUTING
    try {
      await this.jobEngineBindingService.markBindingExecuting(jobId);
    } catch (error: any) {
      // 绑定状态更新失败不影响 Job 状态转换（向后兼容）
      this.logger.warn(`Failed to mark binding as EXECUTING for job ${jobId}: ${error.message} `);
    }

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.RUNNING,
        workerId: worker.id,
        // attempts 只在领取时递增，不在此处递增
      },
    });
  }

  /**
   * 将 Job 标记为 SUCCEEDED，并写入结果
   */
  async markJobSucceeded(jobId: string, resultPayload?: any) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Resource not found');
    }

    // 验证状态转换：必须是 RUNNING -> SUCCEEDED
    transitionJobStatus(job.status, JobStatusEnum.SUCCEEDED, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    const payload = resultPayload
      ? { ...((job.payload as Record<string, any>) || {}), result: resultPayload }
      : (job.payload as any); // Prisma.InputJsonValue 类型在 Prisma 5.22.0 中可能不存在

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.SUCCEEDED,
        payload,
        lastError: undefined,
      },
    });
  }

  /**
   * 将 Job 标记为 FAILED，并记录错误信息
   */
  async markJobFailed(jobId: string, errorMessage?: string, resultPayload?: any) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Resource not found');
    }

    // 验证状态转换：必须是 RUNNING -> FAILED
    transitionJobStatus(job.status, JobStatusEnum.FAILED, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    const payload = resultPayload
      ? { ...((job.payload as Record<string, any>) || {}), result: resultPayload }
      : (job.payload as any); // Prisma.InputJsonValue 类型在 Prisma 5.22.0 中可能不存在

    return this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.FAILED,
        payload,
        lastError: errorMessage || 'Job failed',
      },
    });
  }

  /**
   * 处理 CE Core Layer Job 完成后的 DAG 触发（Stage13）
   * CE06 完成 → 触发 CE03
   * CE03 完成 → 触发 CE04
   */
  /**
   * Orchestrate CE Core Pipeline completion (DAG transitions)
   */
  public async handleCECoreJobCompletion(
    job: ShotJobWithShotHierarchy,
    result?: unknown
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: job.taskId || '' },
    });

    // P5-4: Pipeline Continuity Patch
    // Allow CE11_SHOT_GENERATOR to proceed even if parent Link (taskId) is missing
    // This handles the case where upstream NOVEL_SCAN jobs were created without tasks
    const isOrphanedCE11 = !task && job.type === JobTypeEnum.CE11_SHOT_GENERATOR;

    if (
      !isOrphanedCE11 &&
      (!task ||
        ((task.type as any) !== TaskTypeEnum.CE_CORE_PIPELINE &&
          (task.type as any) !== 'PIPELINE_E2E_VIDEO'))
    ) {
      return;
    }

    const payload = (task?.payload as any) || {};
    // Default pipeline for orphaned CE11: Video Render -> Security
    const pipeline =
      payload.pipeline || (isOrphanedCE11 ? ['VIDEO_RENDER', 'CE09_MEDIA_SECURITY'] : []);

    if (job.type === JobTypeEnum.CE06_NOVEL_PARSING) {
      // Stage-3: CE06 真实层级落库 (Phase 1) - Now via Event Driver
      if (result && (result as any).data) {
        this.logger.log(
          `[Stage-3] CE06 SUCCEEDED, emitting event for project structure sync: ${job.projectId}`
        );
        this.eventEmitter.emit('job.ce06_succeeded', {
          projectId: job.projectId,
          result: result,
        });
      }

      // CE06 完成，触发 CE03
      if (pipeline.includes('CE03_VISUAL_DENSITY')) {
        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
          jobType: JobTypeEnum.CE03_VISUAL_DENSITY,
          payload: {
            projectId: job.projectId,
            engineKey: 'ce03_visual_density',
            previousJobId: job.id,
            previousJobResult: result,
          },
        });
        this.logger.log(`CE06 completed, triggered CE03 for project ${job.projectId}`);
      }
    } else if (job.type === JobTypeEnum.CE03_VISUAL_DENSITY) {
      // CE03 完成，触发 CE04
      if (pipeline.includes('CE04_VISUAL_ENRICHMENT')) {
        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
          jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
          payload: {
            projectId: job.projectId,
            engineKey: 'ce04_visual_enrichment',
            previousJobId: job.id,
            previousJobResult: result,
          },
        });
        this.logger.log(`CE03 completed, triggered CE04 for project ${job.projectId}`);
      }
    } else if (job.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
      // CE04 完成，进入编排环节
      if (
        pipeline.includes('VIDEO_EXPORT') ||
        pipeline.includes('TIMELINE_RENDER') ||
        pipeline.includes('PIPELINE_TIMELINE_COMPOSE')
      ) {
        // [Stage 4.1] Transition CE04 -> PIPELINE_TIMELINE_COMPOSE
        await this.auditLogService.record({
          action: 'CE_DAG_TRANSITION',
          resourceType: 'job',
          resourceId: job.id,
          traceId: job.traceId || task?.traceId || undefined,
          details: {
            from: 'CE04_VISUAL_ENRICHMENT',
            to: 'PIPELINE_TIMELINE_COMPOSE',
            projectId: job.projectId,
          },
        });

        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId || undefined, // TaskId might be undefined for orphaned jobs
          jobType: JobTypeEnum.PIPELINE_TIMELINE_COMPOSE,
          payload: {
            projectId: job.projectId!,
            sceneId: job.sceneId || undefined,
            engineKey: 'timeline_compose',
            previousJobId: job.id,
            previousJobResult: result,
            pipelineRunId: (job.payload as any)?.pipelineRunId || job.id,
          },
        });
        this.logger.log(
          `CE04 completed, triggered PIPELINE_TIMELINE_COMPOSE for project ${job.projectId}`
        );
      }
    } else if (job.type === JobTypeEnum.CE11_SHOT_GENERATOR) {
      // CE11 Completed -> Trigger VIDEO_RENDER for each shot
      // Bible V3.0: Shot Gen -> Video Render
      if (pipeline.includes('VIDEO_RENDER') || pipeline.includes('VIDEO_EXPORT')) {
        const resultData = (result as any)?.output || {};
        const createdShots = resultData.shots || [];

        this.logger.log(
          `CE11 completed for job ${job.id}. Triggering VIDEO_RENDER for ${createdShots.length} shots.`
        );

        for (const shot of createdShots) {
          // Create VIDEO_RENDER job for each shot
          // Ensure we pass traceId and other metadata
          await this.createCECoreJob({
            projectId: job.projectId!,
            organizationId: job.organizationId!,
            taskId: job.taskId || undefined,
            jobType: JobTypeEnum.VIDEO_RENDER,
            payload: {
              projectId: job.projectId,
              sceneId: job.sceneId,
              shotId: shot.id,
              engineKey: 'kling_video_gen_v1', // Default to Kling/Video Gen? Or retrieve from config?
              // For now using a generic key or relying on worker routing defaults
              prompt: shot.visual_prompt || shot.prompt, // Pass prompt clearly
              duration: shot.duration || 5,
              originalJobId: job.id,
              pipelineRunId: (job.payload as any)?.pipelineRunId || job.id,
            },
          });
        }
      }
    } else if (job.type === JobTypeEnum.PIPELINE_TIMELINE_COMPOSE) {
      // 编排完成，进入正式渲染环节
      if (pipeline.includes('VIDEO_EXPORT') || pipeline.includes('TIMELINE_RENDER')) {
        const timelineStorageKey = (result as any)?.timelineStorageKey;
        if (!timelineStorageKey) {
          this.logger.error(
            `[JobService] PIPELINE_TIMELINE_COMPOSE result missing timelineStorageKey for job ${job.id}`
          );
          throw new Error('PIPELINE_TIMELINE_COMPOSE result missing timelineStorageKey');
        }

        await this.auditLogService.record({
          action: 'CE_DAG_TRANSITION',
          resourceType: 'job',
          resourceId: job.id,
          traceId: job.traceId || task?.traceId || undefined,
          details: {
            from: 'PIPELINE_TIMELINE_COMPOSE',
            to: 'TIMELINE_RENDER',
            projectId: job.projectId,
          },
        });

        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
          jobType: JobTypeEnum.TIMELINE_RENDER,
          payload: {
            projectId: job.projectId!,
            sceneId: job.sceneId || undefined,
            engineKey: 'timeline_render',
            previousJobId: job.id,
            previousJobResult: result,
            timelineStorageKey: timelineStorageKey,
            pipelineRunId: (job.payload as any)?.pipelineRunId || job.id,
          },
        });
        this.logger.log(
          `PIPELINE_TIMELINE_COMPOSE completed, triggered TIMELINE_RENDER for project ${job.projectId}`
        );
      }
    } else if (job.type === JobTypeEnum.SHOT_RENDER) {
      // Stage-1: 检查是否所有 SHOT_RENDER 都已完成
      await this.handleStage1ShotCompletion(job);
    } else if (job.type === JobTypeEnum.TIMELINE_RENDER) {
      if (pipeline.includes("CE09_MEDIA_SECURITY")) {
        this.logger.log(`[CE09_FANOUT_ELIGIBLE] TIMELINE_RENDER finished, triggering CE09 for project ${job.projectId}`);
        await this.auditLogService.record({
          action: "CE_DAG_TRANSITION",
          resourceType: "job",
          resourceId: job.id,
          traceId: job.traceId || task?.traceId || undefined,
          details: {
            from: "TIMELINE_RENDER",
            to: "CE09_MEDIA_SECURITY",
            projectId: job.projectId,
          },
        });

        const assetId = (result as any)?.assetId || job.shotId;
        this.logger.log(`[CE09_FANOUT_ENQUEUED] Enqueuing CE09 with assetId: ${assetId}`);

        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
          jobType: JobTypeEnum.CE09_MEDIA_SECURITY,
          payload: {
            assetId,
            originJobId: job.id,
          },
        });
      }
    } else if (job.type === JobTypeEnum.CE09_MEDIA_SECURITY) {
      // CE09 完成，回写 security_processed 和 assets
      await this.handleShotRenderSecurityPipeline(job, result);
    }
  }

  /**
   * 处理 CE09 完成后的安全链路
   * 必须确保：
   * 1. video_jobs.security_processed = true
   * 2. assets 表回写 hls_playlist_url / signed_url / watermark_mode / fingerprint_id
   */
  private async handleShotRenderSecurityPipeline(
    job: ShotJobWithShotHierarchy,
    result?: unknown
  ): Promise<void> {
    try {
      // 1. 查找关联的 VideoJob (通过 shotId)
      const videoJob = await this.prisma.videoJob.findFirst({
        where: { shotId: job.shotId },
        orderBy: { createdAt: 'desc' },
      });

      if (videoJob) {
        // 更新 VideoJob.securityProcessed
        await this.prisma.videoJob.update({
          where: { id: videoJob.id },
          data: {
            securityProcessed: true,
          },
        });

        // 2. 回写 Asset 安全字段 (DBSpec V1.1)
        // 从 CE09 结果中提取安全资产信息
        const securityResult = (result as any)?.securityResult || {};
        const signedUrl =
          securityResult.signedUrl || `https://cdn.example.com/signed/${videoJob.id}.mp4`; // Mock/Shim if not real
        const hlsUrl =
          securityResult.hlsPlaylistUrl || `https://cdn.example.com/hls/${videoJob.id}/master.m3u8`;
        const watermarkMode = securityResult.watermarkMode || 'visible_user_id';
        const fingerprintId = securityResult.fingerprintId || `fp_${job.id}`;

        // 创建或更新 Asset
        // 注意：DBSpec 要求 assets 表有这些字段
        // 这里假设 CE09 产出了一个新的 Asset，或者是更新已有的 Video Asset
        // 简单起见，且为了符合“产出”逻辑，我们创建一个新的 Asset 记录 或 更新 VideoJob 对应的 Raw Asset
        // 这里实现为：创建一个类型为 VIDEO 的 Asset，带有安全字段
        const asset = await this.prisma.asset.create({
          data: {
            projectId: job.projectId!,
            ownerType: 'SHOT', // Polymorphic owner
            ownerId: job.shotId!,
            shotId: job.shotId, // Explicit FK
            type: 'VIDEO',
            storageKey: `secure_videos/${videoJob.id}.mp4`,

            // Security Fields
            signedUrl: signedUrl,
            hlsPlaylistUrl: hlsUrl,
            watermarkMode: watermarkMode,
            fingerprintId: fingerprintId,

            status: 'GENERATED',
          },
        });

        // Audit Trail: SECURITY_COMPLETED
        await this.auditLogService.record({
          action: 'CE09_SECURITY_COMPLETED',
          resourceType: 'asset',
          resourceId: asset.id,
          traceId: job.traceId || undefined,
          details: {
            jobId: job.id,
            videoJobId: videoJob.id,
            securityProcessed: true,
            watermarkMode,
          },
        });

        this.logger.log(
          `CE09: VideoJob ${videoJob.id} security processed, Asset ${asset.id} created with secure URLs`
        );
      } else {
        this.logger.warn(`CE09 completed but no VideoJob found for shotId ${job.shotId}`);
      }
    } catch (error: any) {
      // 软失败：记录 audit_logs（符合 SafetySpec）
      await this.auditLogService
        .record({
          action: 'CE09_SECURITY_PIPELINE_FAIL',
          resourceType: 'job',
          resourceId: job.id,
          traceId: job.traceId || undefined, // Ensure trace propagation
          details: {
            reason: 'CE09 security pipeline failed',
            error: error?.message || 'Unknown error',
            shotId: job.shotId,
            projectId: job.projectId,
          },
        })
        .catch(() => {
          // 审计失败不阻断
        });
      // 结构化日志（不打堆栈）
      this.logger.warn(
        {
          tag: 'CE09_SECURITY_PIPELINE_FAIL',
          jobId: job.id,
          shotId: job.shotId,
          error: error?.message || 'Unknown error',
        },
        'CE09 security pipeline failed'
      );
    }
  }

  /**
   * 处理 CE Core Layer Job 失败（Stage13）
   * 如果任一 CE Job 失败，标记后续未执行的 Job 为 FAILED
   */
  private async handleCECoreJobFailure(job: any): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: job.taskId || '' },
      include: { jobs: true },
    });

    if (!task || task.type !== TaskTypeEnum.CE_CORE_PIPELINE) {
      return;
    }

    const payload = (task.payload as any) || {};
    const pipeline = payload.pipeline || [];

    // 确定失败 Job 在 pipeline 中的位置
    let failedIndex = -1;
    if (job.type === JobTypeEnum.CE06_NOVEL_PARSING) {
      failedIndex = 0;
    } else if (job.type === JobTypeEnum.CE03_VISUAL_DENSITY) {
      failedIndex = 1;
    } else if (job.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
      failedIndex = 2;
    }

    // 标记后续未执行的 Job 为 FAILED，并写 SKIPPED 审计（Stage13-Final）
    if (failedIndex >= 0) {
      for (let i = failedIndex + 1; i < pipeline.length; i++) {
        const nextJobType = pipeline[i];
        const pendingJobs = task.jobs.filter(
          (j: any) => j.type === nextJobType && j.status === JobStatusEnum.PENDING
        );

        for (const pendingJob of pendingJobs) {
          await this.prisma.shotJob.update({
            where: { id: pendingJob.id },
            data: {
              status: JobStatusEnum.FAILED,
              lastError: `Previous CE Job failed: ${job.type} `,
            },
          });

          // Stage13-Final: 为被阻断的 CE04 写 SKIPPED 审计
          if (nextJobType === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
            const engineKey = 'ce04_visual_enrichment';
            const traceId = pendingJob.traceId || task.traceId;

            await this.auditLogService.record({
              action: `CE_${engineKey.toUpperCase()} _SKIPPED`,
              resourceType: 'job',
              resourceId: pendingJob.id,
              details: {
                traceId,
                projectId: pendingJob.projectId,
                jobId: pendingJob.id,
                jobType: nextJobType,
                engineKey,
                status: 'SKIPPED',
                reason: `Previous CE Job failed: ${job.type} `,
              },
            });

            this.logger.warn(
              `CE Pipeline: wrote SKIPPED audit for CE04 job ${pendingJob.id} due to ${job.type} failure`
            );
          }

          this.logger.warn(
            `CE Pipeline failed: marked ${nextJobType} job ${pendingJob.id} as FAILED due to ${job.type} failure`
          );
        }
      }
    }
  }

  /**
   * 获取队列快照，供背压限流使用
   */
  async getQueueSnapshot() {
    const pending = await this.prisma.shotJob.count({
      where: { status: JobStatusEnum.PENDING },
    });
    const running = await this.prisma.shotJob.count({
      where: {
        status: JobStatusEnum.RUNNING,
        leaseUntil: { gt: new Date() },
      },
    });

    return {
      pending,
      running,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Stage-1: 处理镜头渲染成功后的流水线推进
   * 规则：如果发现所有相关 SHOT_RENDER 均已成功，则自动触发合成
   */
  private async handleStage1ShotCompletion(job: ShotJob): Promise<void> {
    const payload = (job.payload as any) || {};
    const pipelineRunId = payload.pipelineRunId;

    if (!pipelineRunId) return;

    // 检查是否存在对应的 Stage-1 Pipeline Job
    const pipelineJob = await this.prisma.shotJob.findFirst({
      where: {
        type: JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
        traceId: pipelineRunId,
      },
    });

    if (!pipelineJob) return;

    // 统计该流水线跑批中尚未成功的 SHOT_RENDER 数量
    const remainingCount = await this.prisma.shotJob.count({
      where: {
        type: JobTypeEnum.SHOT_RENDER,
        status: { notIn: [JobStatusEnum.SUCCEEDED, JobStatusEnum.FAILED] },
        payload: {
          path: ['pipelineRunId'],
          equals: pipelineRunId,
        },
      },
    });

    if (remainingCount === 0) {
      this.logger.log(
        `[Stage-1] All shots completed for run ${pipelineRunId}. Triggering Assemble...`
      );
      await this.triggerStage1PipelineAssemble(pipelineRunId, job.projectId, job.organizationId);
    }
  }

  /**
   * Stage-1: 执行最后的合成动作
   */
  private async triggerStage1PipelineAssemble(
    pipelineRunId: string,
    projectId: string,
    organizationId: string
  ): Promise<void> {
    const succeededShots = await this.prisma.shotJob.findMany({
      where: {
        status: JobStatusEnum.SUCCEEDED,
        payload: {
          path: ['pipelineRunId'],
          equals: pipelineRunId,
        },
      },
      include: { shot: true },
      orderBy: { shot: { index: 'asc' } },
    });

    if (succeededShots.length === 0) {
      this.logger.warn(`[Stage-1] No succeeded shots found for run ${pipelineRunId} to assemble.`);
      return;
    }
    this.logger.log(
      `[Stage-1] Found ${succeededShots.length} succeeded shots for run ${pipelineRunId}`
    );

    // 收集所有已成功的帧存储路径
    const frames = succeededShots
      .map((sj: any) => sj.payload?.result?.output?.storageKey || sj.payload?.result?.storageKey)
      .filter(Boolean);

    if (frames.length === 0) {
      this.logger.warn(`[Stage-1] No frames found for assembly in run ${pipelineRunId}`);
      return;
    }

    // 关联到 Pipeline 的占位镜头（如果有），否则关联到第一个镜头
    const placeholderShot = await this.prisma.shot.findFirst({
      where: {
        type: 'pipeline_stage1',
        scene: { episode: { projectId } },
      },
    });

    const targetShotId = placeholderShot?.id || succeededShots[0].shotId;

    // 继承验证标记：同一 pipelineRunId 下的所有 shot 应该具有相同的 isVerification
    const isVerification = succeededShots[0]?.isVerification || false;

    if (!targetShotId) {
      this.logger.error(
        `[Stage-1] targetShotId is null, cannot assembly video. Run ${pipelineRunId}`
      );
      return;
    }

    await this.ensureVideoRenderJob(
      targetShotId!,
      frames,
      pipelineRunId,
      'system',
      organizationId,
      isVerification
    );

    this.logger.log(
      `[Stage-1] Triggered VIDEO_RENDER for pipelineRunId=${pipelineRunId}, isVerification=${isVerification}`
    );
  }

  /**
   * Stage-1: 处理视频合成任务成功后的发布记录逻辑
   */
  private async handleStage1VideoCompletion(job: ShotJob, result: any): Promise<void> {
    const payload = (job.payload as any) || {};
    const pipelineRunId = payload.pipelineRunId;
    if (!pipelineRunId) return;

    // 检查是否存在对应的 Stage-1 Pipeline Job
    const pipelineJob = await this.prisma.shotJob.findFirst({
      where: {
        type: JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
        traceId: pipelineRunId,
      },
    });

    if (!pipelineJob) return;

    this.logger.log(
      `[Stage-1] VIDEO_RENDER completed for run ${pipelineRunId}. Recording Internal Publication...`
    );

    // 提取 Asset 信息
    const assetId = result?.output?.assetId || result?.assetId;
    const storageKey = result?.output?.storageKey || result?.storageKey;

    if (!assetId || !storageKey) {
      this.logger.warn(
        `[Stage-1] VIDEO_RENDER result missing assetId or storageKey for run ${pipelineRunId}`
      );
      return;
    }

    // 获取校验和
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    const checksum = asset?.checksum || 'unknown';

    await this.publishedVideoService.recordPublishedVideo({
      projectId: job.projectId!,
      episodeId: job.episodeId!,
      assetId,
      storageKey,
      checksum,
      pipelineRunId,
    });
    this.logger.log(
      `[Stage-1] Internal Publication recorded for run ${pipelineRunId} (Asset: ${assetId})`
    );

    // ✅ P4 Gate Fix: Trigger CE09_MEDIA_SECURITY to reach PUBLISHED status
    // CE09 will handle watermark and HLS packaging
    await this.createCECoreJob({
      projectId: job.projectId!,
      organizationId: job.organizationId!,
      taskId: job.taskId!,
      jobType: JobTypeEnum.CE09_MEDIA_SECURITY,
      payload: {
        projectId: job.projectId,
        assetId: assetId,
        shotId: job.shotId || undefined,
        engineKey: 'ce09_media_security',
        previousJobId: job.id,
        previousJobResult: result,
        pipelineRunId: pipelineRunId,
      },
      traceId: pipelineRunId,
    });

    this.logger.log(
      `[Stage-1] Triggered CE09_MEDIA_SECURITY for run ${pipelineRunId} (Asset: ${assetId})`
    );
  }

  /**
   * P14-0: 质量评分 Hook（JobService 落库出口）
   * 下沉到真实的状态持久化后触发，确保所有上报路径都能触发
   */
  private async triggerQualityHookAfterPersist(params: {
    jobId: string;
    jobType: string;
    status: string;
    traceId?: string;
    projectId: string;
    shotId?: string | null;
  }) {
    const { jobId, jobType, status, projectId, shotId, traceId } = params;

    // Gate 同步模式：保证门禁稳定；生产异步模式：不阻塞主链路
    const forceSync =
      process.env.GATE_MODE === '1' || process.env.QUALITY_HOOK_SYNC_FOR_GATE === '1';

    const run = async () => {
      // 1. 业务条件校验（只对 SHOT_RENDER 成功触发）
      if (status !== 'SUCCEEDED') return;
      if (jobType !== 'SHOT_RENDER') return;
      if (!shotId) {
        this.logger.warn(`[QUALITY_HOOK] Skip: shotId missing for job ${jobId}`);
        return;
      }

      // 2. Feature Flag 校验（必须 await，且记录证据日志）
      const enabled = await this.featureFlagService.isAutoReworkEnabled({
        projectId,
        orgId: undefined, // 暂不支持 org 级
      });
      this.logger.log(
        `[QUALITY_HOOK] decide enabled=${enabled} jobId=${jobId} projectId=${projectId} shotId=${shotId}`
      );

      if (!enabled) return;

      // 3. 触发评分
      await this.qualityScoreService.performScoring(shotId, traceId || '', 1);
    };

    const safeRun = async () => {
      try {
        await run();
      } catch (e: any) {
        this.logger.error(
          `[QUALITY_HOOK] failed jobId=${jobId} shotId=${shotId} err=${e?.message}`,
          e?.stack
        );
      }
    };

    if (forceSync) {
      this.logger.log(`[QUALITY_HOOK] Sync mode for job ${jobId}`);
      await safeRun();
    } else {
      this.logger.log(`[QUALITY_HOOK] Async mode for job ${jobId}`);
      setImmediate(() => void safeRun());
    }
  }

  /**
   * P14-0-B: Retrieve job with shot hierarchy for fan-out decisions
   */
  async findJobByIdWithShotHierarchy(jobId: string): Promise<ShotJobWithShotHierarchy | null> {
    return this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: SHOT_JOB_WITH_HIERARCHY,
    }) as Promise<ShotJobWithShotHierarchy | null>;
  }
}
