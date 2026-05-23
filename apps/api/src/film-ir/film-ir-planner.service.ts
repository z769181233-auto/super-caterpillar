import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { FilmIRService } from './film-ir.service';
import { FilmIROutputValidator } from './film-ir-output-validator.service';
import { MockPlannerProvider } from './planner-provider.interface';
import { OpenAIPlannerProvider } from './providers/openai-planner.provider';
import type { IPlannerProvider } from './planner-provider.interface';
import type {
  PlanFilmIRRequest,
  PlanFilmIRResponse,
} from './dto/plan-film-ir.dto';
import type { FilmIRRecord } from 'database';

/**
 * Film IR Planner Service（P2.1 + P2.2 升级）
 *
 * P2.1: Provider + dry-run + save draft + evidence
 * P2.2: 通过 ConfigService 显式选择 planner Provider
 *
 * 配置（packages/config/src/env.ts）：
 * - FILM_IR_PLANNER_ENABLED=true     启用 Planner（默认 false）
 * - FILM_IR_PLANNER_PROVIDER=...     启用时必须显式配置 provider
 * - FILM_IR_PLANNER_MODEL=...        模型名（默认 gpt-4o-mini）
 * - FILM_IR_PLANNER_TIMEOUT_MS=...   超时（默认 30000）
 * - FILM_IR_PLANNER_MAX_RETRIES=...  重试次数（默认 2）
 * - FILM_IR_PLANNER_STRICT_MODE=true warnings 也阻断写 DB
 * - OPENAI_API_KEY=sk-xxx            provider=openai 时必须
 * - FILM_IR_PLANNER_ALLOW_MOCK=1     仅在需要时显式允许 mock provider
 *
 * 关键约束（不可违反）：
 * - dry_run=true 时不写 DB
 * - validation.valid=false 时不写 DB
 * - strict_mode=true 时 warnings 非空也不写 DB
 * - Provider 异常不污染 APPROVED/LOCKED 数据
 * - Planner 只能写 DRAFT 状态
 */
@Injectable()
export class FilmIRPlannerService implements OnModuleInit {
  private readonly logger = new Logger(FilmIRPlannerService.name);
  private provider!: IPlannerProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly filmIRService: FilmIRService,
    private readonly validator: FilmIROutputValidator,
    private readonly auditLogService: AuditLogService,
  ) {}

  onModuleInit() {
    this.provider = this.resolveProvider();
    this.logger.log(
      `[FilmIRPlanner] Provider 初始化: ${this.provider.providerId}/${this.provider.modelId} ` +
      `enabled=${this.configService.get('filmIrPlannerEnabled')} ` +
      `strictMode=${this.configService.get('filmIrPlannerStrictMode')}`,
    );
  }

  /**
   * 根据配置解析 Provider
   */
  private resolveProvider(): IPlannerProvider {
    const plannerEnabled = this.configService.get<boolean>('filmIrPlannerEnabled') ?? false;
    const providerName = (this.configService.get<string>('filmIrPlannerProvider') ?? '').trim().toLowerCase();
    const allowMockProvider =
      process.env.FILM_IR_PLANNER_ALLOW_MOCK === '1' || process.env.NODE_ENV !== 'production';

    if (!plannerEnabled) {
      return new MockPlannerProvider();
    }

    if (!providerName) {
      throw new Error(
        'FILM_IR_PLANNER_PROVIDER must be explicitly configured when Film IR planner is enabled'
      );
    }

    if (providerName === 'openai') {
      const apiKey = this.configService.get<string>('openaiApiKey');
      if (!apiKey) {
        throw new Error(
          'FILM_IR_PLANNER_PROVIDER=openai requires OPENAI_API_KEY; mock fallback is disabled'
        );
      }
      return new OpenAIPlannerProvider(
        apiKey,
        this.configService.get<string>('filmIrPlannerModel') ?? 'gpt-4o-mini',
        this.configService.get<number>('filmIrPlannerTimeoutMs') ?? 30000,
        this.configService.get<number>('filmIrPlannerMaxRetries') ?? 2,
      );
    }

    if (providerName === 'mock') {
      if (!allowMockProvider) {
        throw new Error(
          'FILM_IR_PLANNER_PROVIDER=mock is blocked in production unless FILM_IR_PLANNER_ALLOW_MOCK=1'
        );
      }
      this.logger.warn('[FilmIRPlanner] Mock planner provider enabled explicitly');
      return new MockPlannerProvider();
    }

    throw new Error(`Unsupported Film IR planner provider: ${providerName}`);
  }

  /**
   * P1 最小运行证据：append-only film_ir_runs
   *
   * 这里故意走 raw SQL，避免在当前阶段把 generated Prisma client 也一起拖进大范围变更。
   * 如果本地库尚未应用 migration，则静默降级到仅保留 audit log。
   */
  private async recordPlannerRun(params: {
    sceneId: string;
    projectId: string;
    filmIrId?: string | null;
    plannerVersion: string;
    status: 'SUCCEEDED' | 'FAILED' | 'REJECTED' | 'DRY_RUN';
    inputSnapshot: Record<string, unknown>;
    outputSnapshot?: Record<string, unknown> | null;
    validationValid?: boolean | null;
    validationErrors?: unknown[];
    validationWarnings?: unknown[];
    errorMessage?: string | null;
    evidenceRef?: string | null;
  }): Promise<void> {
    if (typeof (this.prisma as any).$executeRawUnsafe !== 'function') {
      return;
    }

    try {
      await (this.prisma as any).$executeRawUnsafe(
        `
          INSERT INTO film_ir_runs (
            id,
            scene_id,
            project_id,
            film_ir_id,
            planner_version,
            provider,
            model,
            status,
            input_snapshot,
            output_snapshot,
            validation_valid,
            validation_errors,
            validation_warnings,
            error_message,
            evidence_ref
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14,$15
          )
        `,
        randomUUID(),
        params.sceneId,
        params.projectId,
        params.filmIrId ?? null,
        params.plannerVersion,
        this.provider.providerId,
        this.provider.modelId,
        params.status,
        JSON.stringify(params.inputSnapshot ?? {}),
        JSON.stringify(params.outputSnapshot ?? null),
        params.validationValid ?? null,
        JSON.stringify(params.validationErrors ?? []),
        JSON.stringify(params.validationWarnings ?? []),
        params.errorMessage ?? null,
        params.evidenceRef ?? null,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[FilmIRPlanner] film_ir_runs append skipped: ${message}`);
    }
  }

  private toJsonRecord(value: unknown): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
  }

  /**
   * 主规划入口：支持 dry-run + save-draft
   */
  async plan(
    request: PlanFilmIRRequest,
    userId?: string,
  ): Promise<PlanFilmIRResponse> {
    const {
      scene_id,
      source_text,
      source_context_summary,
      dramatic_goal,
      relationship_before,
      relationship_after,
      planner_version = 'film-planner-v1',
      dry_run = false,
      save_as_draft = true,
    } = request;

    const plannerEnabled = this.configService.get<boolean>('filmIrPlannerEnabled') ?? false;
    const strictMode = this.configService.get<boolean>('filmIrPlannerStrictMode') ?? false;

    if (!plannerEnabled) {
      this.logger.warn(
        `[FilmIRPlanner] 请求被拒绝: planner disabled sceneId=${scene_id} version=${planner_version}`,
      );
      throw new ServiceUnavailableException(
        'Film IR planner is disabled. Set FILM_IR_PLANNER_ENABLED=true to enable planning.',
      );
    }

    this.logger.log(
      `[FilmIRPlanner] 开始规划: sceneId=${scene_id} version=${planner_version} dryRun=${dry_run} provider=${this.provider.providerId} strictMode=${strictMode}`,
    );

    // 1. 获取 Scene
    const scene = await this.prisma.scene.findUnique({
      where: { id: scene_id },
      select: { id: true, projectId: true, enrichedText: true },
    });
    if (!scene) {
      throw new BadRequestException(`Scene ${scene_id} not found`);
    }
    if (!scene.projectId) {
      throw new BadRequestException(`Scene ${scene_id} has no projectId`);
    }

    const resolvedSourceText =
      source_text ?? (scene.enrichedText as string | null) ?? '';

    if (!resolvedSourceText.trim()) {
      throw new BadRequestException(
        `Scene ${scene_id} has no enrichedText and no source_text provided`,
      );
    }

    // 2. 调用 Provider
    const invokeInput = {
      sourceText: resolvedSourceText,
      contextSummary: source_context_summary,
      dramaticGoal: dramatic_goal,
      relationshipBefore: relationship_before,
      relationshipAfter: relationship_after,
      plannerVersion: planner_version,
    };

    let invokeResult: Awaited<ReturnType<IPlannerProvider['invoke']>>;
    try {
      invokeResult = await this.provider.invoke(invokeInput);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[FilmIRPlanner] Provider 调用失败: ${message}`);
      await this.recordPlannerRun({
        sceneId: scene_id,
        projectId: scene.projectId,
        plannerVersion: planner_version,
        status: 'FAILED',
        inputSnapshot: invokeInput,
        validationValid: null,
        errorMessage: message,
      });
      await this.auditLogService.record({
        userId,
        action: 'FILM_IR_PLAN_FAILED',
        resourceType: 'film_ir',
        resourceId: scene_id,
        details: {
          sceneId: scene_id,
          provider: this.provider.providerId,
          model: this.provider.modelId,
          error: message,
        },
      });
      throw new UnprocessableEntityException(`LLM Planner 调用失败: ${message}`);
    }

    // 3. 结构化输出校验
    const validation = this.validator.validate(invokeResult.draftFields);

    // 4. 判断是否应写 DB
    const shouldBlock =
      !validation.valid ||                              // error 级别阻断
      (strictMode && validation.warnings.length > 0);  // strict_mode 时 warning 也阻断

    if (dry_run || shouldBlock) {
      if (shouldBlock && !dry_run) {
        const reason = !validation.valid
          ? `${validation.errors.length} 个 errors`
          : `strict_mode 下有 ${validation.warnings.length} 个 warnings`;
        this.logger.warn(`[FilmIRPlanner] 不写 DB: ${reason}`);
        await this.auditLogService.record({
          userId,
          action: 'FILM_IR_PLAN_VALIDATION_FAILED',
          resourceType: 'film_ir',
          resourceId: scene_id,
          details: {
            sceneId: scene_id,
            strictMode,
            errors: validation.errors,
            warnings: validation.warnings,
            provider: this.provider.providerId,
          },
        });
      }
      await this.recordPlannerRun({
        sceneId: scene_id,
        projectId: scene.projectId,
        plannerVersion: planner_version,
        status: dry_run ? 'DRY_RUN' : 'REJECTED',
        inputSnapshot: invokeInput,
        outputSnapshot: this.toJsonRecord(invokeResult.draftFields),
        validationValid: validation.valid,
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      });
      return {
        dry_run: true,
        film_ir_id: null,
        draft_fields: invokeResult.draftFields,
        validation,
        planner_meta: invokeResult.meta,
      };
    }

    // 5. 校验通过 → 写入 DB DRAFT
    let savedFilmIR: FilmIRRecord | null = null;
    if (save_as_draft) {
      const f = invokeResult.draftFields;

      savedFilmIR = await this.filmIRService.create(
        {
          sceneId: scene_id,
          plannerVersion: planner_version,
          sourceText: resolvedSourceText,
          sourceContextSummary: source_context_summary,
        },
        userId,
      );

      savedFilmIR = await this.filmIRService.update(
        savedFilmIR.id,
        {
          dramaticFunction: f.dramatic_function,
          dramaticGoal: f.dramatic_goal,
          emotionalTarget: f.emotional_target,
          visualStrategy: f.visual_strategy,
          shotPattern: f.shot_pattern,
          avgShotLengthSec: f.avg_shot_length,
          whyThisChoice: f.why_this_choice,
        },
        userId,
      );
    }

    // 6. Evidence 落盘
    await this.auditLogService.record({
      userId,
      action: 'FILM_IR_PLANNED',
      resourceType: 'film_ir',
      resourceId: savedFilmIR?.id ?? scene_id,
      details: {
        planner_input_snapshot: {
          sceneId: scene_id,
          sourceTextLength: resolvedSourceText.length,
          plannerVersion: planner_version,
        },
        provider_response_raw: invokeResult.rawOutput.slice(0, 2000), // 截断防超长
        normalized_output_snapshot: {
          dramatic_function: invokeResult.draftFields.dramatic_function,
          shot_pattern: invokeResult.draftFields.shot_pattern,
          avg_shot_length: invokeResult.draftFields.avg_shot_length,
        },
        validation_result: {
          valid: validation.valid,
          error_count: validation.errors.length,
          warning_count: validation.warnings.length,
        },
        persistence_result: {
          saved: savedFilmIR !== null,
          film_ir_id: savedFilmIR?.id ?? null,
          status: 'DRAFT',
        },
        provider_metadata: invokeResult.meta,
      },
    });

    await this.recordPlannerRun({
      sceneId: scene_id,
      projectId: scene.projectId,
      filmIrId: savedFilmIR?.id ?? null,
      plannerVersion: planner_version,
      status: 'SUCCEEDED',
      inputSnapshot: invokeInput,
      outputSnapshot: this.toJsonRecord(invokeResult.draftFields),
      validationValid: validation.valid,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      evidenceRef: savedFilmIR?.evidenceRef ?? null,
    });

    return {
      dry_run: false,
      film_ir_id: savedFilmIR?.id ?? null,
      draft_fields: invokeResult.draftFields,
      validation,
      planner_meta: invokeResult.meta,
    };
  }

  /**
   * 健康检查 — 返回当前 provider 与配置信息
   */
  async health(): Promise<{
    status: string;
    provider: string;
    model: string;
    enabled: boolean;
    strictMode: boolean;
  }> {
    const enabled = this.configService.get<boolean>('filmIrPlannerEnabled') ?? false;
    return {
      status: enabled ? 'ok' : 'disabled',
      provider: this.provider.providerId,
      model: this.provider.modelId,
      enabled,
      strictMode: this.configService.get<boolean>('filmIrPlannerStrictMode') ?? false,
    };
  }
}
