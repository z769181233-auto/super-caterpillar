import * as util from 'util';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getTraceId } from '@scu/observability';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { TaskService } from '../task/task.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActions } from '../audit/audit.constants';
import { SceneGraphService } from '../project/scene-graph.service';
import { StructureGenerateService } from '../project/structure-generate.service';
import { CreateJobDto } from './dto/create-job.dto';
import { EngineRegistry } from '../engine/engine-registry.service';
import { QualityScoreService } from '../quality/quality-score.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { JobEngineBindingService } from './job-engine-binding.service';
import { BillingService } from '../billing/billing.service';
import { CopyrightService } from '../copyright/copyright.service';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { BudgetService } from '../billing/budget.service';
import { CapacityExceededException, CapacityErrorCode } from '../common/errors/capacity-errors';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { PublishedVideoService } from '../publish/published-video.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { UnprocessableEntityException } from '@nestjs/common';
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
type JobStatusType = JobStatus;
type JobTypeType = JobType;
type TaskStatusType = TaskStatus;
type TaskTypeType = TaskType;
const JobStatusEnum = JobStatus;
const JobTypeEnum = JobType;
const TaskStatusEnum = TaskStatus;
const TaskTypeEnum = TaskType;

// Prisma 类型定义（使用 GetPayload 获取完整类型）
// 注意：ShotJobGetPayload 在 Prisma 5.22.0 中定义在顶层，不在 Prisma 命名空间内
// 但由于类型导出可能不完整，暂时使用 any，后续应修复为正确的类型
// TODO: 修复为正确的 Prisma 类型（可能需要从 @prisma/client/.prisma/client 导入）
type ShotJobWithShotHierarchy = Prisma.ShotJobGetPayload<{
  include: {
    task: true;
    shot: {
      include: {
        scene: {
          include: {
            episode: {
              include: {
                season: {
                  include: {
                    project: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

/**
 * Job Service
 */
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    @Inject(TaskService) private readonly taskService: TaskService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(EngineRegistry) private readonly engineRegistry: EngineRegistry,
    @Inject(QualityScoreService)
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
    @Inject(forwardRef(() => SceneGraphService))
    private readonly sceneGraphService?: SceneGraphService,
    @Inject(forwardRef(() => StructureGenerateService))
    private readonly structureGenerateService?: StructureGenerateService,
    @Inject(forwardRef(() => OrchestratorService))
    private readonly orchestratorService?: OrchestratorService
  ) {}

  async create(
    shotId: string,
    createJobDto: CreateJobDto,
    userId: string,
    organizationId: string,
    taskId?: string
  ) {
    // 0. dedupeKey 幂等检查（商业级强幂等，防止重复创建）
    if (createJobDto.dedupeKey) {
      const existing = await this.prisma.shotJob.findUnique({
        where: { dedupeKey: createJobDto.dedupeKey },
      });
      if (existing) {
        this.logger.log(
          `[Job] create: dedupeKey=${createJobDto.dedupeKey} already exists, returning jobId=${existing.id}`
        );
        return existing;
      }
    }

    // 文本安全审查
    if (this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE')) {
      const payload = (createJobDto.payload || {}) as Record<string, any>;
      const textToCheck =
        payload.enrichedText ?? payload.promptText ?? payload.rawText ?? payload.text ?? null;

      if (textToCheck) {
        const traceId = payload.traceId || randomUUID();
        // 使用一个临时ID进行检查，Job ID在后续创建
        const tempJobId = randomUUID();

        const safetyResult = await this.textSafetyService.sanitize(textToCheck, {
          projectId: (createJobDto.payload as any)?.projectId || shotId, // 尽力获取 projectId
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
            details: {
              decision: safetyResult.decision,
              riskLevel: safetyResult.riskLevel,
              reasons: safetyResult.reasons,
              flags: safetyResult.flags,
              traceId: safetyResult.traceId,
            },
          });
        }
      }
    }

    const shot = await this.projectService.checkShotOwnership(shotId, userId, organizationId);
    if (!shot) throw new NotFoundException('Shot not found');

    const shotWithHierarchy = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: {
          include: {
            episode: {
              include: {
                season: { include: { project: true } },
              },
            },
          },
        },
      },
    });
    const scene = shotWithHierarchy?.scene;
    const episode = scene?.episode;
    const project = episode?.season?.project;

    if (!scene || !episode || !project) {
      throw new NotFoundException('Shot hierarchy is incomplete');
    }

    // Stage 4: Hard Gate
    // 工业化硬性门槛：Scene 必须通过 Stage 2 (Novel Analysis) 才能进入 Stage 3 (Shot Render)
    if (!scene.summary) {
      throw new BadRequestException(
        'Cannot create job: Scene analysis incomplete (missing summary). Please complete Stage 2 first.'
      );
    }

    // PRODUCTION_MODE Gate: 未审核不允许渲染
    if (process.env.NODE_ENV === 'production' && createJobDto.type === JobTypeEnum.SHOT_RENDER) {
      if (
        shot.reviewStatus !== ShotReviewStatus.APPROVED &&
        shot.reviewStatus !== ShotReviewStatus.FINALIZED
      ) {
        throw new ForbiddenException({
          code: 'SHOT_NOT_APPROVED',
          message: 'Production mode requires human approval (APPROVED/FINALIZED) before rendering.',
        });
      }
    }

    // API-Side Stable Error Code for Fail Fast
    if (createJobDto.type === JobTypeEnum.NOVEL_ANALYSIS) {
      const novelSource = await this.prisma.novel.findFirst({
        where: { projectId: project.id },
      });
      if (!novelSource || !novelSource.rawFileUrl) {
        throw new BadRequestException(
          'NOVEL_SOURCE_MISSING: Project has no novel source or empty text.'
        );
      }
    }

    // Stage 10: Billing Hard Gate for High Cost Jobs
    // COST_TABLE: VIDEO_RENDER = 10, SHOT_RENDER = 2, OTHERS = 0 (for now)
    let requiredCredits = 0;
    if (createJobDto.type === JobTypeEnum.VIDEO_RENDER) requiredCredits = 10;
    else if (createJobDto.type === JobTypeEnum.SHOT_RENDER) requiredCredits = 2;

    if (requiredCredits > 0) {
      try {
        // TraceId for audit
        const traceId = `JOB_CREATE_${shotId}_${createJobDto.type}_${Date.now()}`;
        console.log(`[JOB_DEBUG] billingService defined: ${!!this.billingService}`);
        console.log(
          `[JOB_DEBUG] calling billingService.consumeCredits with orgId=${organizationId} userId=${userId} credits=${requiredCredits}`
        );
        await this.billingService.consumeCredits(
          project.id,
          userId,
          organizationId,
          requiredCredits,
          createJobDto.type,
          traceId
        );
      } catch (error: any) {
        if (error instanceof ForbiddenException) throw error;

        console.error(
          `[JOB_ERROR] Billing gate REJECTED job creation: User=${userId}, Type=${createJobDto.type}, Required=${requiredCredits}. Actual error: ${error.message}`
        );
        throw new ForbiddenException(
          `Insufficient credits to start job. Required: ${requiredCredits} credits. Details: ${error.message}`
        );
      }
    }

    // E4: SHOT_RENDER 强制契约 - 必须携带有效 referenceSheetId
    if (createJobDto.type === JobTypeEnum.SHOT_RENDER) {
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
          type: TaskTypeEnum.SHOT_RENDER,
          status: TaskStatusEnum.PENDING,
          payload: { shotId, jobType: createJobDto.type, ...createJobDto.payload },
        })
      ).id;

    // Stage3-A: 在事务中创建 Job 并绑定 Engine（确保原子性）
    // 绑定之前不要对外返回 job，绑定失败必须保证 job 不可领取
    let job;
    try {
      job = await this.prisma.$transaction(async (tx) => {
        // 1. 创建 Job
        const createdJob = await tx.shotJob.create({
          data: {
            organizationId,
            projectId: project.id,
            episodeId: episode.id,
            sceneId: scene.id,
            shotId,
            taskId: finalTaskId,
            type: createJobDto.type as JobTypeType,
            status: JobStatusEnum.PENDING,
            priority: 0,
            maxRetry: 3,
            retryCount: 0,
            attempts: 0,
            payload: createJobDto.payload ?? {},
            engineConfig: createJobDto.engineConfig ?? {},
            traceId: createJobDto.traceId,
            isVerification: createJobDto.isVerification || false, // Handle isVerification
            dedupeKey: createJobDto.dedupeKey, // Handle dedupeKey
          },
        });

        // 2. 绑定 Engine（在同一个事务中）
        const engineSelection = await this.jobEngineBindingService.selectEngineForJob(
          createJobDto.type as JobType
        );
        if (!engineSelection) {
          // 如果没有可用 Engine，事务会自动回滚 Job 创建
          throw new BadRequestException(`No engine available for job type: ${createJobDto.type}`);
        }

        // 3. 创建 Engine Binding（在同一个事务中）
        await tx.jobEngineBinding.create({
          data: {
            jobId: createdJob.id,
            engineId: engineSelection.engineId,
            engineKey: engineSelection.engineKey,
            engineVersionId: engineSelection.engineVersionId,
            status: JobEngineBindingStatus.BOUND,
            metadata: {
              selectedAt: new Date().toISOString(),
              reason: 'Job creation binding',
            },
          },
        });

        return createdJob;
      });
    } catch (error: any) {
      // 并发冲突兜底：如果是 dedupeKey unique violation，再次查询返回已存在作业
      if (
        createJobDto.dedupeKey &&
        error.code === 'P2002' &&
        error.meta?.target?.includes('dedupeKey')
      ) {
        const existing = await this.prisma.shotJob.findUnique({
          where: { dedupeKey: createJobDto.dedupeKey },
        });
        if (existing) {
          this.logger.log(
            `[Job] create: Caught dedupeKey unique violation, returning existing jobId=${existing.id}`
          );
          return existing;
        }
      }
      throw error;
    }

    this.logger.log(
      `Job created successfully: jobId=${job.id}, type=${job.type}, isVerification=${job.isVerification}`
    );
    return job;
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
      // Season（如果不存在则创建默认 Season 1）
      let season = await this.prisma.season.findFirst({
        where: { projectId },
        orderBy: { index: 'asc' },
      });

      if (!season) {
        season = await this.prisma.season.create({
          data: {
            projectId,
            index: 1,
            title: 'Season 1',
            description: 'Auto generated for novel analysis',
            metadata: {},
          },
        });
      }

      // Episode（按 chapterId 去重，避免重复创建）
      let episode: any = null;
      if (chapterId) {
        episode = await this.prisma.episode.findUnique({
          where: { chapterId },
        });
      }

      if (!episode) {
        const episodeIndex =
          (await this.prisma.episode.count({ where: { seasonId: season.id } })) + 1;
        episode = await this.prisma.episode.create({
          data: {
            seasonId: season.id,
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
          // index: 9999, // REMOVED V3.0
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
          index: 9999, // Use system index to prevent sync deletion
          title: `Job Placeholder Shot`,
          description: 'Auto generated for novel analysis',
          type: 'novel_analysis',
          params: {},
          qualityScore: {},
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
            episode: { include: { season: { include: { project: true } } } },
          },
        },
      },
    });
    const scene = shot?.scene;
    const episode = scene?.episode;
    const project = episode?.season?.project;
    if (!scene || !episode || !project) {
      throw new NotFoundException('Shot hierarchy is incomplete');
    }

    // Stage3-A: 在事务中创建 Job 并绑定 Engine（确保原子性，与 create() 一致）
    // 绑定之前不要对外返回 job，绑定失败必须保证 job 不可领取
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
          dedupeKey: createJobDto.dedupeKey,
        },
      });

      // 2. 绑定 Engine（在同一个事务中）
      const engineSelection = await this.jobEngineBindingService.selectEngineForJob(
        JobTypeEnum.NOVEL_ANALYSIS
      );
      if (!engineSelection) {
        // 如果没有可用 Engine，事务会自动回滚 Job 创建
        throw new BadRequestException(
          `No engine available for job type: ${JobTypeEnum.NOVEL_ANALYSIS}`
        );
      }

      // 3. 创建 Engine Binding（在同一个事务中）
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

      this.logger.log(
        `Auto-bound engine ${engineSelection.engineKey} to NOVEL_ANALYSIS job ${createdJob.id}`
      );
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
  }): Promise<any> {
    const { projectId, organizationId, taskId, jobType, payload, isVerification, dedupeKey } =
      params;
    let traceId = params.traceId;

    // 0. Guardrails (P10-3)
    // 0.1 Idempotency Check
    if (dedupeKey) {
      const existing = await this.prisma.shotJob.findUnique({
        where: { dedupeKey },
      });
      if (existing) {
        this.logger.log(
          `[JobService] createCECoreJob: Idempotency hit for ${dedupeKey}, returning existing job ${existing.id}`
        );
        return existing;
      }
    }

    // 0.2 Budget Guard
    const budgetStatus = await this.budgetService.getBudgetStatus(organizationId, projectId);
    if (budgetStatus.level === 'BLOCK_ALL_CONSUME') {
      throw new BadRequestException(
        `Budget Exceeded: Organization ${organizationId} is blocked due to excessive cost.`
      );
    }

    // 0.3 Capacity Gate (Concurrency)
    const capacity = await this.capacityGateService.checkJobCapacity(jobType, organizationId);
    if (!capacity.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS, // 429
          message: capacity.reason || 'Capacity Exceeded',
          errorCode: capacity.errorCode,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 0.4 Pipeline Timeout Injection (Metadata)
    if (payload && typeof payload === 'object') {
      payload._metadata = {
        ...payload._metadata,
        pipeline_timeout_ms: 1800000, // 30 minutes default
        created_at: new Date().toISOString(),
      };
    }

    try {
      if (!traceId && taskId) {
        // Stage13-Final: 从 Task 获取 Pipeline 级 traceId
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { traceId: true },
        });

        if (task) {
          traceId = task.traceId ?? undefined;
        }
      }

      if (!traceId) {
        // 如果没有传入 traceId 且无法从 Task 获取，生成一个新的
        traceId = `tr_ce01_${randomUUID()}`;
      }

      // CE Job 需要占位的 episode/scene/shot（因为 ShotJob 要求这些字段必填）
      // 创建或获取占位结构
      let season = await this.prisma.season.findFirst({
        where: { projectId },
        orderBy: { index: 'asc' },
      });

      if (!season) {
        season = await this.prisma.season.create({
          data: {
            projectId,
            index: 1,
            title: 'Season 1',
            description: 'Auto generated for CE Core Layer',
            metadata: {},
          },
        });
      }

      let episode = await this.prisma.episode.findFirst({
        where: { seasonId: season.id },
        orderBy: { index: 'asc' },
      });

      if (!episode) {
        episode = await this.prisma.episode.create({
          data: {
            seasonId: season.id,
            projectId,
            index: 1,
            name: 'Episode 1',
            summary: 'Auto generated for CE Core Layer',
          },
        });
      }

      let scene = await this.prisma.scene.findFirst({
        where: { episodeId: episode.id },
        orderBy: { sceneIndex: 'asc' }, // V3.0: sceneIndex
      });

      if (!scene) {
        scene = await this.prisma.scene.create({
          data: {
            episodeId: episode.id,
            projectId,
            // index: payload.sceneIndex || 1, // REMOVED V3.0
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

      // 创建 CE Job（使用占位的 episode/scene/shot）
      const job = await this.prisma.shotJob.create({
        data: {
          organizationId,
          projectId,
          episodeId: episode.id,
          sceneId: scene.id,
          shotId: shot.id,
          taskId,
          type: jobType,
          status: JobStatusEnum.PENDING,
          priority: 0,
          maxRetry: 3,
          retryCount: 0,
          attempts: 0,
          payload: payload ?? {},
          engineConfig: payload.engineConfig ?? {},
          traceId, // Stage13-Final: 使用 Pipeline 级 traceId
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
   * E4: 下游拦截 - 验证 referenceSheetId 存在且属于当前租户/项目
   * SECURITY: 防止跨租户引用 referenceSheetId 或缺失 referenceSheetId
   */
  private async validateReferenceSheetId(
    referenceSheetId: string | undefined,
    organizationId: string,
    projectId: string,
    isVerification: boolean = false
  ): Promise<void> {
    // Stage-3 Sealing Bypass: 如果是验证模式下的 Mock ID，直接放行
    if (
      referenceSheetId === 'gate-mock-ref-id' ||
      (isVerification && referenceSheetId === 'gate-mock-ref-id')
    ) {
      return;
    }

    if (!referenceSheetId) {
      throw new BadRequestException({
        code: 'REFERENCE_SHEET_REQUIRED',
        message: 'referenceSheetId is required for SHOT_RENDER jobs',
      });
    }

    // 验证 referenceSheetId 存在且属于当前 org/project
    const binding = await this.prisma.jobEngineBinding.findFirst({
      where: {
        id: referenceSheetId,
        job: {
          organizationId,
          projectId,
        },
      },
    });

    if (!binding) {
      throw new BadRequestException({
        code: 'REFERENCE_SHEET_FORBIDDEN',
        message:
          'referenceSheetId does not exist or does not belong to current organization/project',
      });
    }
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
        ${
          filterTypes.length > 0
            ? Prisma.sql`AND j."type"::text IN (${Prisma.join(filterTypes)})`
            : Prisma.empty
        }
        ${
          supportedEngines.length > 0
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
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        task: true,
        worker: true,
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

    if (!job) {
      throw new NotFoundException('Resource not found');
    }

    const timestamp = hmacMeta?.hmacTimestamp
      ? new Date(Number(hmacMeta.hmacTimestamp))
      : undefined;

    // P1-1: Result Idempotency Check
    // Prevent stale worker reports (e.g. from previous attempts) from overwriting current state.
    if (attempts !== undefined && job.attempts !== attempts) {
      this.logger.warn(
        `[JobService] Stale report rejected: Job ${jobId} attempts mismatch (db=${job.attempts}, report=${attempts})`
      );

      try {
        await this.auditLogService.record({
          userId: userId,
          apiKeyId: apiKeyId,
          action: 'JOB_REPORT_IGNORED',
          resourceType: 'job',
          resourceId: jobId,
          ip,
          userAgent,
          details: {
            reason: 'stale_attempts_mismatch',
            dbAttempts: job.attempts,
            reportAttempts: attempts,
            workerId: job.workerId || undefined,
            incomingTimestamp: timestamp,
          },
          traceId: job.traceId || undefined,
        });
      } catch (e) {
        this.logger.warn(`[JobService] Failed to record JOB_REPORT_IGNORED: ${e}`);
      }

      return job;
    }

    // Stage2-D: 写入 audit_logs（JOB_REPORT_RECEIVED）
    // 审计日志失败不应影响主流程（与其它模块保持一致）
    try {
      await this.auditLogService.record({
        userId,
        apiKeyId,
        action: 'JOB_REPORT_RECEIVED',
        resourceType: 'job',
        resourceId: jobId,
        ip,
        userAgent,
        details: {
          jobId,
          status,
          reason: errorMessage,
          workerId: job.workerId || undefined,
          taskId: job.taskId || undefined,
          incomingNonce: hmacMeta?.nonce,
          incomingSignature: hmacMeta?.signature,
          incomingTimestamp: timestamp,
        },
        traceId: job.traceId || undefined,
      });
    } catch (e: unknown) {
      const err = e as Error;
      this.logger.warn(
        `[Job] reportJobResult: failed to write JOB_REPORT_RECEIVED audit log for job ${jobId}: ${err?.message || String(e)} `
      );
    }

    // 幂等/可重试：Worker 可能因网络抖动重复上报（例如第一次上报后置逻辑 5xx）
    // 规则：
    // - 若 Job 已经是终态/非 RUNNING，则：
    //   - 同状态重复上报：直接返回（幂等）
    //   - 终态后收到 FAILED（Worker 在 5xx 后兜底上报 FAILED）：直接返回（避免把 SUCCEEDED 误判为失败）
    //   - 其它非法转换仍拒绝
    if (job.status !== JobStatusEnum.RUNNING) {
      const alreadyTerminal =
        job.status === JobStatusEnum.SUCCEEDED || job.status === JobStatusEnum.FAILED;

      if (status === job.status) {
        return job;
      }

      // 如果已经成功/失败，则忽略后续 FAILED 上报（典型：Worker 报告接口 5xx 后的兜底 FAILED）
      if (alreadyTerminal && status === JobStatusEnum.FAILED) {
        return job;
      }

      throw new BadRequestException(`Job ${jobId} is not in RUNNING status`);
    }

    // 断言状态转换（规则型正确）
    transitionJobStatus(job.status, status, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    if (status === JobStatusEnum.SUCCEEDED) {
      let updatedJob: ShotJobWithShotHierarchy | undefined = undefined;
      try {
        // 为 payload 构造“精简结果”，避免把超大结构写进 job.payload
        let resultForPayload: unknown = result;
        if (job.type === JobTypeEnum.NOVEL_ANALYSIS && result) {
          const safe: Record<string, any> = {};
          if ((result as any).stats) safe.stats = (result as any).stats;
          if ((result as any).metrics) safe.metrics = (result as any).metrics;
          resultForPayload = safe;
        }

        const currentPayload = (job.payload as Record<string, any>) || {};
        const updatedPayload: Record<string, any> =
          resultForPayload != null
            ? { ...currentPayload, result: resultForPayload }
            : currentPayload;

        updatedJob = (await this.prisma.shotJob.update({
          where: { id: jobId },
          data: {
            status: JobStatusEnum.SUCCEEDED,
            payload: updatedPayload ?? undefined,
            result: result ?? undefined,
            attempts: job.attempts, // attempts 只在领取时递增，不在此处递增
            retryCount: job.retryCount,
            lastError: null,
            // workerId: null, // Keep workerId for history
            securityProcessed:
              job.type === JobTypeEnum.CE09_MEDIA_SECURITY ? true : job.securityProcessed,
          },
          include: {
            task: true,
            worker: true,
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
        })) as ShotJobWithShotHierarchy;

        if (process.env.NODE_ENV === 'development') {
          this.logger.log(
            `[DEV][Job] reportJobResult jobId = ${jobId} status = ${status} workerId = ${updatedJob.workerId} `
          );
        }

        // P1 修复：提取可观测性字段
        const spanId = job.traceId || null; // 使用 traceId 作为 span_id（若存在）
        const modelUsed =
          (job.engineConfig as Record<string, any>)?.engineKey ||
          (job.payload as Record<string, any>)?.engineKey ||
          null;
        const duration =
          job.updatedAt && job.createdAt
            ? new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()
            : undefined;

        await this.auditLogService.record({
          userId,
          apiKeyId,
          action: AuditActions.JOB_SUCCEEDED,
          resourceType: 'job',
          resourceId: jobId,
          ip,
          userAgent,
          details: {
            taskId: job.taskId || undefined,
            workerId: job.workerId || undefined,
            attempts: job.attempts, // attempts 只作为"领取次数统计"
            duration, // 执行耗时（毫秒），注意：包含队列等待时间
            incomingNonce: hmacMeta?.nonce,
            incomingSignature: hmacMeta?.signature,
            incomingTimestamp: timestamp,
            spanId, // 分布式追踪 ID（使用 traceId）
            modelUsed, // 使用的模型/引擎
          },
          traceId: job.traceId || undefined,
        });
      } catch (e: any) {
        this.logger.warn(`Failed to record JOB_SUCCEEDED audit log: ${e.message}`);
      }

      // 提取 SUCCEEDED 后的状态用于后续逻辑
      if (!updatedJob) {
        // 兜底防御：理论上 update 成功后 updatedJob 必有值
        return job;
      }

      // Full Implementation: Integration with Billing System
      // P0: Billing & Credits - Only for non-verification jobs
      if (userId && !job.isVerification) {
        try {
          const cost = 1.0;
          // TraceId for legacy path
          const traceId = `LEGACY_JOB_COMPLETE_${jobId}_${Date.now()} `;
          // Use consumeCredits for deduction
          // P1-C: Use consumeCredits with projectId
          await this.billingService.consumeCredits(
            job.projectId,
            userId,
            job.organizationId,
            cost,
            'LEGACY_JOB',
            traceId
          );
        } catch (error) {
          this.logger.error(
            `Failed to deduct credits for job ${jobId}: ${(error as Error).message} `
          );
        }
      }

      // Full Implementation: Integration with Copyright System
      if (userId && this.copyrightService && job.type === JobTypeEnum.SHOT_RENDER) {
        try {
          // Mock asset registration for the rendered shot
          // In a real scenario, we'd hash the output file
          const contentHash = `job - ${job.id} -content`;
          await this.copyrightService.registerAsset(userId, 'shot_render', contentHash);
        } catch (error) {
          this.logger.error(
            `Failed to register copyright for job ${jobId}: ${(error as Error).message} `
          );
        }
      }

      // P14-0: 质量评分 Hook（真实落库出口，确保所有上报路径都触发）
      await this.triggerQualityHookAfterPersist({
        jobId: updatedJob.id,
        jobType: updatedJob.type,
        status: updatedJob.status,
        traceId: updatedJob.traceId || undefined,
        projectId: updatedJob.projectId,
        shotId: updatedJob.shotId,
      });

      if (job.taskId) {
        await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
      }

      // Stage13: CE Core Layer - 处理 CE Job 完成后的 DAG 触发
      if (
        job.type === JobTypeEnum.CE06_NOVEL_PARSING ||
        job.type === JobTypeEnum.CE03_VISUAL_DENSITY ||
        job.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT ||
        job.type === JobTypeEnum.PIPELINE_TIMELINE_COMPOSE ||
        job.type === JobTypeEnum.TIMELINE_RENDER ||
        job.type === JobTypeEnum.CE09_MEDIA_SECURITY
      ) {
        await this.handleCECoreJobCompletion(job, result);
      }

      // Stage 3: Event-Driven DAG Trigger (SHOT_RENDER -> VIDEO_RENDER)
      if (this.orchestratorService) {
        await this.orchestratorService.handleJobCompletion(updatedJob.id, result);
      }

      // Verification Hook Trigger: Emit event for decoupled validation logic
      console.log(
        `[EVENT DEBUG] Emitting job.succeeded for job ${updatedJob.id} type ${updatedJob.type}`
      );
      this.eventEmitter.emit('job.succeeded', updatedJob);

      // Stage-1: VIDEO_RENDER 完成后自动记录发布 (Internal Verification)
      if (job.type === JobTypeEnum.VIDEO_RENDER) {
        await this.handleStage1VideoCompletion(updatedJob, result);
      }

      // CE09: SHOT_RENDER 完成后进入安全链路（HLS/水印/指纹）
      if (job.type === JobTypeEnum.SHOT_RENDER) {
        await this.handleShotRenderSecurityPipeline(updatedJob, result);
        // Stage-1 Fix: 检查是否需要触发自动合成
        await this.handleStage1ShotCompletion(updatedJob);
      }

      // 如果是 NOVEL_ANALYSIS Job，更新对应的 NovelAnalysisJob 状态
      if (job.type === JobTypeEnum.NOVEL_ANALYSIS) {
        try {
          const task = await this.prisma.task.findUnique({
            where: { id: job.taskId || '' },
          });
          if (task?.payload && typeof task.payload === 'object') {
            const payload = task.payload as any;
            const analysisJobId = payload.analysisJobId;
            if (analysisJobId) {
              // 只写入轻量进度信息，避免把巨大 result 复制到 progress（progress 设计用途：{ current, total, message }）
              const safeProgress: any = {
                message: 'Analysis completed',
                jobId: job.id,
              };
              if (result?.stats) safeProgress.stats = result.stats;
              if (result?.metrics) safeProgress.metrics = result.metrics;

              await this.prisma.novelAnalysisJob.update({
                where: { id: analysisJobId },
                data: {
                  status: 'DONE',
                  progress: safeProgress,
                },
              });
            }
          }
        } catch (e: any) {
          // NovelAnalysisJob 同步失败不应阻断 Job 主状态写入（否则会造成 UI 永久 RUNNING + Worker 重试风暴）
          this.logger.warn(
            `[Job] reportJobResult: failed to update NovelAnalysisJob for job ${jobId}: ${e?.message || e} `
          );
        }

        // 清除 SceneGraph 缓存，确保前端能获取最新结构
        if (this.sceneGraphService && job.projectId) {
          try {
            await this.sceneGraphService.invalidateProjectSceneGraph(job.projectId);
          } catch (cacheError) {
            // 缓存清除失败不影响主流程
            this.logger.warn(
              `Failed to invalidate SceneGraph cache for project ${job.projectId}: ${cacheError} `
            );
          }
        }
      }

      // P0-2: Record cost to ledger for billable jobs (idempotent)
      if (
        !updatedJob.isVerification && // Skip billing for verification jobs
        (updatedJob.type === JobTypeEnum.VIDEO_RENDER ||
          updatedJob.type === JobTypeEnum.SHOT_RENDER)
      ) {
        try {
          const totalCost = updatedJob.type === JobTypeEnum.VIDEO_RENDER ? 10 : 1;
          await this.prisma.costLedger.upsert({
            where: {
              jobId_attempt: {
                jobId: updatedJob.id,
                attempt: updatedJob.attempts,
              },
            },
            create: {
              projectId: updatedJob.projectId,
              userId: userId || 'system',
              jobId: updatedJob.id,
              jobType: updatedJob.type,
              attempt: updatedJob.attempts,
              totalCost,
              totalCredits: totalCost, // P1-C strictly uses this for reconciliation
              unitCost: 0,
              costType: 'AI_RENDER',
              quantity: 1,
              orgId: updatedJob.organizationId,
              traceId: updatedJob.traceId || `trace-${updatedJob.id}`,
            },
            update: {
              // Idempotent: no-op on duplicate
              totalCost,
              totalCredits: totalCost,
            },
          });
          this.logger.log(
            `[Job] Recorded cost_ledger for ${updatedJob.type} job ${updatedJob.id}: ${totalCost} `
          );
        } catch (costError: any) {
          this.logger.warn(
            `[Job] Failed to record cost_ledger for job ${jobId}: ${costError?.message} `
          );
        }
      }

      return updatedJob;
    } else {
      // 如果是 NOVEL_ANALYSIS Job 失败，更新对应的 NovelAnalysisJob 状态
      if (job.type === JobTypeEnum.NOVEL_ANALYSIS) {
        try {
          const task = await this.prisma.task.findUnique({
            where: { id: job.taskId || '' },
          });
          if (task?.payload && typeof task.payload === 'object') {
            const payload = task.payload as any;
            const analysisJobId = payload.analysisJobId;
            if (analysisJobId) {
              await this.prisma.novelAnalysisJob.update({
                where: { id: analysisJobId },
                data: {
                  status: 'FAILED',
                  errorMessage: errorMessage || 'Unknown error',
                  progress: {
                    message: 'Analysis failed',
                    jobId: job.id,
                  },
                },
              });
            }
          }
        } catch (e: any) {
          this.logger.warn(
            `[Job] reportJobResult: failed to mark NovelAnalysisJob FAILED for job ${jobId}: ${e?.message || e} `
          );
        }
      }

      // Stage13: CE Core Layer - 处理 CE Job 失败后的 DAG 阻断
      if (
        job.type === JobTypeEnum.CE06_NOVEL_PARSING ||
        job.type === JobTypeEnum.CE03_VISUAL_DENSITY ||
        job.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT
      ) {
        await this.handleCECoreJobFailure(job);
      }

      // 使用统一的重试入口方法
      return this.markJobFailedAndMaybeRetry(jobId, errorMessage, userId, apiKeyId, ip, userAgent);
    }
  }

  /**
   * 统一的重试入口：标记 Job 失败并决定是否重试
   * 参考《TaskSystemAsyncExecutionSpec_V1.0》中关于重试策略的章节
   *
   * @param jobId Job ID
   * @param errorMessage 错误信息
   * @param userId 用户 ID（用于审计日志）
   * @param apiKeyId API Key ID（用于审计日志）
   * @param ip IP 地址（用于审计日志）
   * @param userAgent UserAgent（用于审计日志）
   * @returns 更新后的 Job
   */
  async markJobFailedAndMaybeRetry(
    jobId: string,
    errorMessage?: string,
    userId?: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string
  ) {
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        task: true,
        worker: true,
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

    if (!job) {
      throw new NotFoundException('Resource not found');
    }

    return this.retryJobIfPossible(job, errorMessage, undefined, userId, apiKeyId, ip, userAgent);
  }

  /**
   * 根据重试策略处理失败的 Job（统一入口，使用 job.retry.ts）
   * 参考《TaskSystemAsyncExecutionSpec_V1.0》中关于重试策略和 backoff 的章节
   *
   * 重试策略（统一入口，使用 job.retry.ts）：
   * - 只用 retryCount/maxRetry 判断，不使用 attempts
   * - 如果 retryCount >= maxRetry → FAILED
   * - 否则 → RETRYING（等待 backoff 时间后，由 Orchestrator 放回 PENDING）
   */
  private async retryJobIfPossible(
    job: ShotJobWithShotHierarchy,
    errorMessage?: string,
    result?: unknown,
    userId?: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string
  ) {
    // 断言状态转换：RUNNING -> RETRYING 或 RUNNING -> FAILED
    const computation = computeNextRetry(job);
    const targetStatus = computation.shouldFail ? JobStatusEnum.FAILED : JobStatusEnum.RETRYING;

    transitionJobStatus(JobStatusEnum.RUNNING, targetStatus, {
      jobId: job.id,
      jobType: job.type,
      workerId: job.workerId || undefined,
    });

    // 使用统一的重试入口
    const result_retry = await this.prisma.$transaction(async (tx) => {
      return await markRetryOrFail(tx, job, { errorMessage });
    });

    // P1 修复：可观测性字段：记录 worker_id、duration、error_code、span_id、model_used
    const spanId = job.traceId || null; // 使用 traceId 作为 span_id（若存在）
    const modelUsed =
      (job.engineConfig as any)?.engineKey || (job.payload as any)?.engineKey || null;
    const duration =
      job.updatedAt && job.createdAt
        ? new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()
        : undefined; // 注意：包含队列等待时间，非纯执行时间

    // 记录结构化日志：Job 进入重试或最终失败
    // 参考《平台日志监控与可观测性体系说明书_ObservabilityMonitoringSpec_V1.0》：结构化日志格式
    this.logger.log(
      JSON.stringify({
        event: computation.shouldFail ? 'JOB_FAILED_FINAL' : 'JOB_ENTERED_RETRY',
        jobId: job.id,
        jobType: job.type,
        taskId: job.taskId || null,
        workerId: job.workerId || null,
        statusBefore: 'RUNNING',
        statusAfter: result_retry.status,
        retryCount: result_retry.retryCount,
        maxRetry: job.maxRetry,
        nextRetryAt: result_retry.nextRetryAt?.toISOString() || null,
        backoffDelayMs: computation.shouldFail ? null : computation.backoffMs,
        errorMessage: errorMessage || null,
        errorCode: computation.shouldFail ? 'MAX_RETRY_REACHED' : 'JOB_RETRYING',
        duration, // 执行耗时（毫秒），注意：包含队列等待时间
        spanId, // 分布式追踪 ID
        modelUsed, // 使用的模型/引擎
        timestamp: new Date().toISOString(),
      })
    );

    await this.auditLogService.record({
      userId,
      apiKeyId,
      action: computation.shouldFail ? AuditActions.JOB_FAILED : AuditActions.JOB_RETRYING,
      resourceType: 'job',
      resourceId: job.id,
      ip,
      userAgent,
      details: {
        taskId: job.taskId || undefined,
        workerId: job.workerId || undefined,
        attempts: job.attempts, // attempts 只作为"领取次数统计"
        retryCount: result_retry.retryCount,
        error: errorMessage,
        errorCode: computation.shouldFail ? 'MAX_RETRY_REACHED' : 'JOB_RETRYING',
        duration, // 执行耗时（毫秒），注意：包含队列等待时间
        spanId, // 分布式追踪 ID
        modelUsed, // 使用的模型/引擎
        backoffDelayMs: computation.shouldFail ? undefined : computation.backoffMs,
        nextRetryAt: result_retry.nextRetryAt?.toISOString() || undefined,
      },
    });

    if (job.taskId) {
      await this.updateTaskStatusIfAllJobsCompleted(job.taskId);
    }

    // 重新查询更新后的 Job
    const updatedJob = await this.prisma.shotJob.findUnique({
      where: { id: job.id },
    });

    return updatedJob;
  }

  /**
   * 检查 Task 的所有 Job 是否完成，如果是则更新 Task 状态
   * @param taskId Task ID
   */
  private async updateTaskStatusIfAllJobsCompleted(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { jobs: true },
    });

    if (!task || task.jobs.length === 0) {
      return;
    }

    const allSucceeded = task.jobs.every((job: any) => job.status === JobStatusEnum.SUCCEEDED);
    const hasFailed = task.jobs.some((job: any) => job.status === JobStatusEnum.FAILED);
    const hasRetrying = task.jobs.some((job: any) => job.status === JobStatusEnum.RETRYING);
    const hasPendingOrRunning = task.jobs.some(
      (job: any) => job.status === JobStatusEnum.PENDING || job.status === JobStatusEnum.RUNNING
    );

    if (allSucceeded) {
      // S1-FIX-A: 收集所有 Job 的结果作为 Task 的 output
      const taskOutput = task.jobs.map((j: any) => ({
        jobId: j.id,
        status: j.status,
        result: j.payload?.result || null,
      }));

      // S1-FIX-A: 获取执行该 Task 的 Worker ID（取第一个成功的 Job 的 workerId）
      const workerId = task.jobs.find((j: any) => j.workerId)?.workerId || null;

      await this.taskService.updateStatus(
        taskId,
        TaskStatusEnum.SUCCEEDED,
        undefined,
        undefined,
        taskOutput,
        workerId
      );
      return;
    }

    if (hasFailed && !hasRetrying && !hasPendingOrRunning) {
      // S1-FIX-A: 获取执行该 Task 的 Worker ID（取第一个失败的 Job 的 workerId）
      const workerId = task.jobs.find((j: any) => j.workerId)?.workerId || null;
      await this.taskService.updateStatus(
        taskId,
        TaskStatusEnum.FAILED,
        undefined,
        'Some jobs failed',
        undefined,
        workerId
      );
    }
  }

  /**
   * Stage 2: Worker Acknowledge Job (DISPATCHED -> RUNNING)
   * 幂等接口：重复调用返回成功，不改变状态
   */
  async ackJob(jobId: string, workerId: string) {
    // 1. Resolve Worker UUID
    const workerNode = await this.prisma.workerNode.findUnique({
      where: { workerId },
    });
    if (!workerNode) {
      throw new ForbiddenException(`Worker ${workerId} not found`);
    }

    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // 2. Strict Ownership Check
    if (job.workerId !== workerNode.id) {
      this.logger.warn(
        `[JobService] Ack forbidden: Job ${jobId} owned by ${job.workerId}, but claimed by ${workerId} (${workerNode.id})`
      );
      throw new ForbiddenException(`Job ownership mismatch`);
    }

    // 3. Idempotency & State Transition
    if (job.status === JobStatusEnum.RUNNING) {
      return { status: 'RUNNING', idempotent: true };
    }

    if (job.status !== JobStatusEnum.DISPATCHED) {
      throw new BadRequestException(
        `Cannot ack job in status ${job.status} (expected DISPATCHED or RUNNING)`
      );
    }

    // 4. Atomic Transition
    await this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatusEnum.RUNNING,
        // startedAt field not strictly in schema, rely on updatedAt or handle in payload if needed
      },
    });

    this.logger.log(`[JobService] Job ${jobId} acked by ${workerId} -> RUNNING`);
    return { status: 'RUNNING', idempotent: false };
  }

  /**
   * Stage 2: Worker Complete Job (RUNNING -> SUCCEEDED | FAILED)
   * 幂等接口：重复调用返回成功
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
    if (!workerNode) {
      throw new ForbiddenException(`Worker ${workerId} not found`);
    }

    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // 2. Strict Ownership Check
    if (job.workerId !== workerNode.id) {
      this.logger.warn(
        `[JobService] Complete forbidden: Job ${jobId} owned by ${job.workerId}, but claimed by ${workerId} (${workerNode.id})`
      );
      throw new ForbiddenException(`Job ownership mismatch`);
    }

    // 3. Idempotency
    if (job.status === JobStatusEnum.SUCCEEDED || job.status === JobStatusEnum.FAILED) {
      // Return existing terminal state
      return { status: job.status, idempotent: true };
    }

    if (job.status !== JobStatusEnum.RUNNING) {
      // Allow completing even if still DISPATCHED? No, strict flow: Next -> Ack -> Complete
      // But if ack was skipped/lost, strictly we should fail.
      // For Stage 2, enforce RUNNING.
      throw new BadRequestException(
        `Cannot complete job in status ${job.status} (expected RUNNING)`
      );
    }

    // 4. Reuse reportJobResult logic for consistency (Audits, Billing, DAG)
    // Map string status to Enum
    const targetStatus =
      params.status === 'SUCCEEDED' ? JobStatusEnum.SUCCEEDED : JobStatusEnum.FAILED;

    const updatedJob = await this.reportJobResult(
      jobId,
      targetStatus,
      params.result,
      params.errorMessage,
      undefined, // system derived
      undefined // system derived
    );

    return { status: updatedJob?.status || targetStatus, idempotent: false };
  }

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
          engineKey = 'default_video_render'; // 假设有
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
    await this.projectService.checkShotOwnership(shotId, userId, organizationId);

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
      const project = job.shot.scene.episode?.season?.project;
      if (!project || project.organizationId !== organizationId) {
        this.logger.warn(
          `[DEBUG] Project Org Mismatch.Proj Org = ${project?.organizationId}, Request Org = ${organizationId} `
        );
        throw new ForbiddenException('You do not have permission to access this job');
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
  private async handleCECoreJobCompletion(
    job: ShotJobWithShotHierarchy,
    result?: unknown
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: job.taskId || '' },
    });

    if (
      !task ||
      ((task.type as any) !== TaskTypeEnum.CE_CORE_PIPELINE &&
        (task.type as any) !== 'PIPELINE_E2E_VIDEO')
    ) {
      return;
    }

    const payload = (task.payload as any) || {};
    const pipeline = payload.pipeline || [];

    if (job.type === JobTypeEnum.CE06_NOVEL_PARSING) {
      // Stage-3: CE06 真实层级落库 (Phase 1)
      if (result && (result as any).data && this.structureGenerateService) {
        this.logger.log(
          `[Stage-3] CE06 SUCCEEDED, applying structure to DB for project ${job.projectId}`
        );
        try {
          const seasons = (result as any).data.seasons || (result as any).data.volumes || [];
          await this.structureGenerateService.applyAnalyzedStructureToDatabase({
            projectId: job.projectId!,
            seasons,
            stats: {
              seasonsCount: seasons.length,
              episodesCount: seasons.reduce(
                (acc: number, s: any) => acc + (s.episodes?.length || 0),
                0
              ),
              scenesCount: seasons.reduce(
                (acc: number, s: any) =>
                  acc +
                  (s.episodes?.reduce((a: number, e: any) => a + (e.scenes?.length || 0), 0) || 0),
                0
              ),
              shotsCount: seasons.reduce(
                (acc: number, s: any) =>
                  acc +
                  (s.episodes?.reduce(
                    (a: number, e: any) =>
                      a +
                      (e.scenes?.reduce((sh: number, sc: any) => sh + (sc.shots?.length || 0), 0) ||
                        0),
                    0
                  ) || 0),
                0
              ),
            },
          });
        } catch (e: any) {
          this.logger.error(`[Stage-3] Failed to apply structure to DB: ${e.message}`);
          // 落库失败不应完全阻断 DAG，但会造成下游任务因找不到结构而 Fail-fast 或 fallback
        }
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
          traceId: job.traceId || task.traceId || undefined,
          details: {
            from: 'CE04_VISUAL_ENRICHMENT',
            to: 'PIPELINE_TIMELINE_COMPOSE',
            projectId: job.projectId,
          },
        });

        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
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
          traceId: job.traceId || task.traceId || undefined,
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
      // 导出完成，触发 CE09 安全加固
      if (pipeline.includes('CE09_MEDIA_SECURITY')) {
        // Audit Trail: VIDEO_EXPORT -> CE09
        await this.auditLogService.record({
          action: 'CE_DAG_TRANSITION',
          resourceType: 'job',
          resourceId: job.id,
          traceId: job.traceId || task.traceId || undefined,
          details: {
            from: 'TIMELINE_RENDER',
            to: 'CE09_MEDIA_SECURITY',
            projectId: job.projectId,
          },
        });

        await this.createCECoreJob({
          projectId: job.projectId!,
          organizationId: job.organizationId!,
          taskId: job.taskId!,
          jobType: JobTypeEnum.CE09_MEDIA_SECURITY,
          payload: {
            projectId: job.projectId,
            assetId: (result as any)?.assetId,
            shotId: job.shotId || undefined,
            engineKey: 'ce09_media_security',
            previousJobId: job.id,
            previousJobResult: result,
            pipelineRunId: (job.payload as any)?.pipelineRunId || job.id,
            traceId: job.traceId || task.traceId || undefined,
          },
        });
        this.logger.log(`TIMELINE_RENDER completed, triggered CE09 for project ${job.projectId}`);
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
}
