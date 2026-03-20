import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
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
 * P2.1: Mock Provider + dry-run + save draft + evidence
 * P2.2: 通过 ConfigService 动态切换 mock/openai Provider
 *
 * 配置（packages/config/src/env.ts）：
 * - FILM_IR_PLANNER_ENABLED=true     启用 Planner（默认 false）
 * - FILM_IR_PLANNER_PROVIDER=openai  切换到 OpenAI（默认 mock）
 * - FILM_IR_PLANNER_MODEL=...        模型名（默认 gpt-4o-mini）
 * - FILM_IR_PLANNER_TIMEOUT_MS=...   超时（默认 30000）
 * - FILM_IR_PLANNER_MAX_RETRIES=...  重试次数（默认 2）
 * - FILM_IR_PLANNER_STRICT_MODE=true warnings 也阻断写 DB
 * - OPENAI_API_KEY=sk-xxx            provider=openai 时必须
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
    const providerName = this.configService.get<string>('filmIrPlannerProvider') ?? 'mock';

    if (providerName === 'openai') {
      const apiKey = this.configService.get<string>('openaiApiKey');
      if (!apiKey) {
        this.logger.error('[FilmIRPlanner] FILM_IR_PLANNER_PROVIDER=openai 但 OPENAI_API_KEY 未设置，回退到 Mock');
        return new MockPlannerProvider();
      }
      return new OpenAIPlannerProvider(
        apiKey,
        this.configService.get<string>('filmIrPlannerModel') ?? 'gpt-4o-mini',
        this.configService.get<number>('filmIrPlannerTimeoutMs') ?? 30000,
        this.configService.get<number>('filmIrPlannerMaxRetries') ?? 2,
      );
    }

    return new MockPlannerProvider();
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
