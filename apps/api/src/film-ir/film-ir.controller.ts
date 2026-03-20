import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FilmIRService } from './film-ir.service';
import { FilmIRPlannerService } from './film-ir-planner.service';
import { CreateFilmIRDto, UpdateFilmIRDto } from './dto/create-film-ir.dto';
import type { PlanFilmIRRequest } from './dto/plan-film-ir.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { JobType } from 'database';

/**
 * Film IR Controller — P1/P2-0/P2-1 阶段
 *
 * 路由前缀：/film-ir
 *
 * 端点一览（按职责分组）：
 *
 * [CRUD + 状态机]
 *   GET  /film-ir/health          — 健康检查
 *   POST /film-ir/plan            — 手动创建 stub 记录 (P1)
 *   GET  /film-ir/:id             — 详情
 *   GET  /film-ir/scene/:sceneId  — Scene 最新 Film IR
 *   PATCH /film-ir/:id            — 更新（DRAFT/APPROVED，LOCKED 拒）
 *   POST /film-ir/:id/approve     — DRAFT → APPROVED
 *   POST /film-ir/:id/lock        — APPROVED → LOCKED（不可逆）
 *   POST /film-ir/:id/replan      — 版本递增重建
 *
 * [LLM Planner — P2-1]
 *   POST /film-ir/planner/plan    — LLM 规划（dry-run + save draft）
 *   GET  /film-ir/planner/health  — Planner 健康检查
 */
@Controller('film-ir')
export class FilmIRController {
  constructor(
    private readonly filmIRService: FilmIRService,
    private readonly plannerService: FilmIRPlannerService,
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
  ) {}

  private normalizeTraceSegment(value: unknown, fallback: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      return fallback;
    }
    return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  }

  private buildDirectorTraceId(prefix: string, targetId: string, variant?: unknown): string {
    const suffix = this.normalizeTraceSegment(variant, 'v1');
    return `${prefix}_${targetId}_${suffix}`;
  }

  private buildDirectorDedupeKey(jobType: string, targetId: string, variant?: unknown): string {
    const suffix = this.normalizeTraceSegment(variant, 'v1');
    return `${jobType}:${targetId}:${suffix}`;
  }

  private async resolveSceneContext(sceneId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        id: true,
        projectId: true,
        episode: {
          select: {
            project: {
              select: {
                id: true,
                organizationId: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!scene) {
      throw new NotFoundException(`Scene ${sceneId} not found`);
    }

    const project = scene.episode?.project;
    const projectId = scene.projectId ?? project?.id;
    const organizationId = project?.organizationId ?? null;

    if (!projectId || !organizationId) {
      throw new BadRequestException(`Scene ${sceneId} project hierarchy is incomplete`);
    }

    return {
      sceneId: scene.id,
      projectId,
      organizationId,
      ownerId: project?.ownerId ?? 'system-worker',
    };
  }

  private async resolveShotContext(shotId: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      select: {
        id: true,
        organizationId: true,
        scene: {
          select: {
            id: true,
            projectId: true,
            episode: {
              select: {
                project: {
                  select: {
                    id: true,
                    organizationId: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shot) {
      throw new NotFoundException(`Shot ${shotId} not found`);
    }

    const project = shot.scene?.episode?.project;
    const projectId = shot.scene?.projectId ?? project?.id;
    const organizationId = shot.organizationId ?? project?.organizationId ?? null;

    if (!projectId || !organizationId || !shot.scene?.id) {
      throw new BadRequestException(`Shot ${shotId} hierarchy is incomplete`);
    }

    return {
      shotId: shot.id,
      sceneId: shot.scene.id,
      projectId,
      organizationId,
      ownerId: project?.ownerId ?? 'system-worker',
    };
  }

  // ==================================================================
  // 健康检查
  // ==================================================================

  /** GET /film-ir/health */
  @Get('health')
  health() {
    return this.filmIRService.health();
  }

  /** GET /film-ir/planner/health */
  @Get('planner/health')
  plannerHealth() {
    return this.plannerService.health();
  }

  // ==================================================================
  // CRUD + 状态机端点
  // ==================================================================

  /**
   * 手动创建 Film IR stub 记录（P1 遗留，P2-1 之后推荐使用 /planner/plan）
   * POST /film-ir/plan
   */
  @Post('plan')
  @HttpCode(HttpStatus.CREATED)
  plan(@Body() dto: CreateFilmIRDto) {
    return this.filmIRService.create(dto);
  }

  /** GET /film-ir/scene/:sceneId — 必须在 /:id 之前注册，避免路由冲突 */
  @Get('scene/:sceneId')
  findByScene(@Param('sceneId') sceneId: string) {
    return this.filmIRService.findByScene(sceneId);
  }

  /** GET /film-ir/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filmIRService.findOne(id);
  }

  /** PATCH /film-ir/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFilmIRDto) {
    return this.filmIRService.update(id, dto);
  }

  /** POST /film-ir/:id/approve — DRAFT → APPROVED */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string) {
    return this.filmIRService.approve(id);
  }

  /** POST /film-ir/:id/lock — APPROVED → LOCKED（不可逆）*/
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(@Param('id') id: string) {
    return this.filmIRService.lock(id);
  }

  /** POST /film-ir/:id/replan — 版本递增，保留历史 */
  @Post(':id/replan')
  @HttpCode(HttpStatus.CREATED)
  replan(@Param('id') id: string) {
    return this.filmIRService.replan(id);
  }

  // ==================================================================
  // LLM Planner 端点（P2-1）
  // ==================================================================

  /**
   * LLM 规划 Film IR（支持 dry-run + save draft）
   * POST /film-ir/planner/plan
   *
   * Body: PlanFilmIRRequest
   *   - scene_id: string（必填）
   *   - dry_run: boolean（默认 false）
   *   - save_as_draft: boolean（默认 true）
   *   - ... 其他可选导演约束字段
   */
  @Post('planner/plan')
  @HttpCode(HttpStatus.CREATED)
  plannerPlan(@Body() request: PlanFilmIRRequest) {
    return this.plannerService.plan(request);
  }

  /**
   * POST /film-ir/planner/enqueue
   * 正式 enqueue 入口：创建 CE_FILM_IR_PLAN job
   */
  @Post('planner/enqueue')
  @UseGuards(JwtOrHmacGuard)
  @HttpCode(HttpStatus.CREATED)
  async enqueuePlannerJob(
    @Body() body: Record<string, any>,
    @CurrentOrganization() currentOrganizationId: string | null,
  ) {
    const sceneId = body.scene_id ?? body.sceneId;
    if (!sceneId || typeof sceneId !== 'string') {
      throw new BadRequestException('scene_id is required');
    }

    const scene = await this.resolveSceneContext(sceneId);
    const plannerVersion = body.planner_version ?? body.plannerVersion ?? 'film-planner-v1';
    const traceId =
      body.trace_id ??
      body.traceId ??
      this.buildDirectorTraceId('film_ir', sceneId, plannerVersion);
    const organizationId = currentOrganizationId ?? scene.organizationId;
    const dedupeKey =
      body.dedupe_key ??
      body.dedupeKey ??
      this.buildDirectorDedupeKey('CE_FILM_IR_PLAN', sceneId, plannerVersion);

    const job = await this.jobService.createCECoreJob({
      projectId: scene.projectId,
      organizationId,
      jobType: 'CE_FILM_IR_PLAN' as JobType,
      payload: {
        scene_id: sceneId,
        source_text: body.source_text ?? body.sourceText,
        source_context_summary: body.source_context_summary ?? body.sourceContextSummary,
        dramatic_goal: body.dramatic_goal ?? body.dramaticGoal,
        relationship_before: body.relationship_before ?? body.relationshipBefore,
        relationship_after: body.relationship_after ?? body.relationshipAfter,
        planner_version: plannerVersion,
        dry_run: body.dry_run ?? body.dryRun ?? false,
        save_as_draft: body.save_as_draft ?? body.saveAsDraft ?? true,
      },
      traceId,
      dedupeKey,
      priority: body.priority,
      isVerification: body.is_verification ?? body.isVerification,
    });

    return {
      scene_id: sceneId,
      job_id: job.id,
      job_type: 'CE_FILM_IR_PLAN',
      status: 'QUEUED',
      trace_id: job.traceId ?? traceId,
    };
  }

  /**
   * POST /film-ir/scene/:sceneId/shot-plan
   * 正式 enqueue 入口：创建 CE_SHOT_PLAN job
   */
  @Post('scene/:sceneId/shot-plan')
  @UseGuards(JwtOrHmacGuard)
  @HttpCode(HttpStatus.CREATED)
  async enqueueShotPlanJob(
    @Param('sceneId') sceneId: string,
    @Body() body: Record<string, any>,
    @CurrentOrganization() currentOrganizationId: string | null,
  ) {
    const scene = await this.resolveSceneContext(sceneId);
    const plannerVersion = body.planner_version ?? body.plannerVersion ?? 'shot-planner-v1';
    const traceId =
      body.trace_id ??
      body.traceId ??
      this.buildDirectorTraceId('shot_plan', sceneId, plannerVersion);
    const organizationId = currentOrganizationId ?? scene.organizationId;
    const dedupeKey =
      body.dedupe_key ??
      body.dedupeKey ??
      this.buildDirectorDedupeKey('CE_SHOT_PLAN', sceneId, plannerVersion);

    const job = await this.jobService.createCECoreJob({
      projectId: scene.projectId,
      organizationId,
      jobType: 'CE_SHOT_PLAN' as JobType,
      payload: {
        sceneId,
        novelSceneId: sceneId,
        traceId,
        engineKey: body.engine_key ?? body.engineKey,
        engineVersion: body.engine_version ?? body.engineVersion,
        seed: body.seed,
        pipelineRunId: body.pipeline_run_id ?? body.pipelineRunId,
        plannerVersion,
        organizationId,
      },
      traceId,
      dedupeKey,
      priority: body.priority,
      isVerification: body.is_verification ?? body.isVerification,
    });

    return {
      scene_id: sceneId,
      job_id: job.id,
      job_type: 'CE_SHOT_PLAN',
      status: 'QUEUED',
      trace_id: job.traceId ?? traceId,
    };
  }

  /**
   * POST /film-ir/scene/:sceneId/consistency-check
   * 正式 enqueue 入口：创建 CE_CONSISTENCY_CHECK job
   */
  @Post('scene/:sceneId/consistency-check')
  @UseGuards(JwtOrHmacGuard)
  @HttpCode(HttpStatus.CREATED)
  async enqueueConsistencyCheckJob(
    @Param('sceneId') sceneId: string,
    @Body() body: Record<string, any>,
    @CurrentOrganization() currentOrganizationId: string | null,
  ) {
    const scene = await this.resolveSceneContext(sceneId);
    const stateVersion = body.state_version ?? body.stateVersion ?? 'continuity-v1';
    const traceId =
      body.trace_id ??
      body.traceId ??
      this.buildDirectorTraceId('continuity', sceneId, stateVersion);
    const organizationId = currentOrganizationId ?? scene.organizationId;
    const dedupeKey =
      body.dedupe_key ??
      body.dedupeKey ??
      this.buildDirectorDedupeKey('CE_CONSISTENCY_CHECK', sceneId, stateVersion);

    const job = await this.jobService.createCECoreJob({
      projectId: scene.projectId,
      organizationId,
      jobType: 'CE_CONSISTENCY_CHECK' as JobType,
      payload: {
        sceneId,
        projectId: scene.projectId,
        traceId,
        stateVersion,
      },
      traceId,
      dedupeKey,
      priority: body.priority,
      isVerification: body.is_verification ?? body.isVerification,
    });

    return {
      scene_id: sceneId,
      job_id: job.id,
      job_type: 'CE_CONSISTENCY_CHECK',
      status: 'QUEUED',
      trace_id: job.traceId ?? traceId,
    };
  }

  /**
   * POST /film-ir/shot/:shotId/content-judge
   * 正式 enqueue 入口：创建 CE_CONTENT_JUDGE job
   */
  @Post('shot/:shotId/content-judge')
  @UseGuards(JwtOrHmacGuard)
  @HttpCode(HttpStatus.CREATED)
  async enqueueContentJudgeJob(
    @Param('shotId') shotId: string,
    @Body() body: Record<string, any>,
    @CurrentOrganization() currentOrganizationId: string | null,
  ) {
    const shot = await this.resolveShotContext(shotId);
    const gateVersion = body.gate_version ?? body.gateVersion ?? 'content-judge-v1';
    const traceId =
      body.trace_id ??
      body.traceId ??
      this.buildDirectorTraceId('content_judge', shotId, gateVersion);
    const organizationId = currentOrganizationId ?? shot.organizationId;
    const dedupeKey =
      body.dedupe_key ??
      body.dedupeKey ??
      this.buildDirectorDedupeKey('CE_CONTENT_JUDGE', shotId, gateVersion);

    const job = await this.jobService.createCECoreJob({
      projectId: shot.projectId,
      organizationId,
      jobType: 'CE_CONTENT_JUDGE' as JobType,
      payload: {
        shotId,
        sceneId: shot.sceneId,
        projectId: shot.projectId,
        traceId,
        gateVersion,
        attempt: body.attempt,
      },
      traceId,
      dedupeKey,
      priority: body.priority,
      isVerification: body.is_verification ?? body.isVerification,
    });

    return {
      shot_id: shotId,
      job_id: job.id,
      job_type: 'CE_CONTENT_JUDGE',
      status: 'QUEUED',
      trace_id: job.traceId ?? traceId,
    };
  }
}
