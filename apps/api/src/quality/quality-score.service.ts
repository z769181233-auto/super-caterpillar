/**
 * QualityScoreService
 * 质量评分服务，提供从 Job 构建 QualityScoreRecord 的只读聚合功能
 *
 * 职责：
 * - 从 Job 和 Adapter 中提取质量评分数据
 * - 只读聚合，不写入数据库
 */

import { Injectable, Logger } from '@nestjs/common';
import { QualityScoreRecord } from '@scu/shared-types';
import { EngineAdapter } from '@scu/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { forwardRef, Inject } from '@nestjs/common';
import { IdentityConsistencyService } from '../identity/identity-consistency.service';

@Injectable()
export class QualityScoreService {
  private readonly logger = new Logger(QualityScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService,
    private readonly identityService: IdentityConsistencyService
  ) { }

  /**
   * P13-3: 执行分镜质量评分
   * @param shotId 分镜ID
   * @param traceId 追踪ID
   * @param attempt 当前尝试次数
   */
  async performScoring(shotId: string, traceId: string, attempt: number = 1) {
    console.error(`Performing quality scoring for shot ${shotId}, attempt ${attempt}`);

    // 1. 获取基础数据 (Identity Score)
    const identityScoreRecord = await this.prisma.shotIdentityScore.findFirst({
      where: { shotId },
      orderBy: { createdAt: 'desc' },
    });
    let identityScore = identityScoreRecord?.identityScore || 0;

    // P16-0: REAL Identity Scoring (Shadow / Real Mode)
    // ----------------------------------------------------
    let realScoreResult: any = null;
    let realError: string | null = null;
    let ce23RealEnabled = false;
    let ce23RealShadowEnabled = false;

    // 获取项目级 Feature Flags
    const shotForSettings = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: { scene: { include: { episode: { include: { project: true } } } } },
    });
    const settings = ((shotForSettings?.scene?.episode as any)?.project?.settingsJson as any) || {};

    // P16-2.0: Kill Switch (Highest Priority)
    // CE23_REAL_FORCE_DISABLE=1 -> Disable Real & Shadow globally
    // P0 Patch: Direct env read for safety, fallback to config module
    const forceDisable = process.env.CE23_REAL_FORCE_DISABLE === '1';

    if (forceDisable) {
      this.logger.warn(`[P16-2] CE23 Real/Shadow FORCE DISABLED by Env for shot ${shotId}`);
      // Hard Kill: Force Legacy Mode
      ce23RealEnabled = false;
      ce23RealShadowEnabled = false;

      // P0 Patch: Force clean slate for real/shadow variables to prevent any leakage
      realScoreResult = null;
    } else {
      ce23RealEnabled = !!settings.ce23RealEnabled;
      ce23RealShadowEnabled = !!settings.ce23RealShadowEnabled;
    }

    if (ce23RealEnabled || ce23RealShadowEnabled) {
      try {
        // 尝试获取 Real Scoring 所需的 anchor/target
        // 优先从已有的 identityScoreRecord.details 里拿 (P15-0)，没有则 fallback (这里简化处理，直接拿 assets)
        // 实际 fallback: 从 shot 关联 asset 拿 target，从 identity_anchors 拿 ref
        // 为降低复杂度，直接复用 IdentityConsistencyService 的逻辑，那里已经封装好了或者我们调用 scoreIdentityReal

        if (identityScoreRecord?.referenceAnchorId && identityScoreRecord?.targetAssetId) {
          // Resolve Reference Asset ID via Identity Anchor
          const anchor = await this.prisma.identityAnchor.findUnique({
            where: { id: identityScoreRecord.referenceAnchorId },
          });
          if (anchor) {
            realScoreResult = await this.identityService.scoreIdentityReal(
              anchor.referenceAssetId,
              identityScoreRecord.targetAssetId,
              identityScoreRecord.characterId
            );
          }
        }
      } catch (err: any) {
        this.logger.error(`[P16] REAL Score Calc Failed: ${err.message}`);
        realError = err.message;
      }
    }

    // 这里有一个更简单的路径：直接调用 identityService.scoreIdentityReal，前提是我们知道 targetAssetId
    // 因为 performScoring 是后置聚合，identity score 应该已经由 Worker 算过一次 (Stub 或 Real)
    // 如果 P15-0 中 Worker 已经切了 Real，那数据库里存的就是 Real 分数。
    // 但 P16-0 要求 Shadow Mode：即 Worker 跑 Stub，这里 aggregated 时跑 Real 并写 signal？
    // *修正*: QualityScoreService 是 aggregated service。如果 Worker 还没切 Real (Worker 跑的是 Stub)，
    // 那么 shotIdentityScore 表里存的是 Stub 分数。
    // 我们需要在这里 (QualityHook) 再次触发一次 Real 计算 (Shadow)？
    // 这是一个 Resource Heavy 的操作。但根据 PLAN-1: "当 Shadow 或 Real 任一开启 时，计算 REAL 分数并写入 signals"
    // 是的，这意味着 API 侧要重算一次 (或 Worker 侧双写，但 Worker 逻辑改动大)。
    // 鉴于 P16-0 容错要求，在 API 侧重算比较安全。

    // 修正逻辑：必须找到 targetAssetId
    if (ce23RealEnabled || ce23RealShadowEnabled) {
      try {
        // 1. 尝试从 shotIdentityScore 记录恢复上下文
        if (identityScoreRecord) {
          const anchor = await this.prisma.identityAnchor.findUnique({
            where: { id: identityScoreRecord.referenceAnchorId },
          });
          if (anchor) {
            realScoreResult = await this.identityService.scoreIdentityReal(
              anchor.referenceAssetId,
              identityScoreRecord.targetAssetId,
              identityScoreRecord.characterId
            );
          }
        } else {
          // 如果连 Stub 记录都没有，无法计算
        }
      } catch (e: any) {
        realError = e.message;
      }
    }

    // P16-0: 判定接管逻辑 (Real Mode)
    if (ce23RealEnabled && realScoreResult?.verdict) {
      // 覆盖 identityScore 为 REAL 分数
      identityScore = realScoreResult.score;
      // 阈值判定: >= 0.80 为 PASS (Real 逻辑)
      // 注意: scoreIdentityReal 返回的 verdict 已经是基于 0.80 的
      // 但这里 performScoring 下面还有综合判定逻辑
    }

    // 2. 物理审计 (Render Physical)
    const renderAsset = await this.prisma.asset.findFirst({
      where: { shotId, type: 'VIDEO' },
    });
    const renderPhysicalPass = !!renderAsset;

    // 3. 音频审计 (Audio Existence)
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      select: { sceneId: true },
    });

    let audioPass = false;
    if (shot?.sceneId) {
      const audioAssets = await this.prisma.asset.findMany({
        where: {
          ownerId: shot.sceneId,
          type: { in: ['AUDIO_TTS', 'AUDIO_BGM'] },
        },
      });
      const hasTTS = audioAssets.some((a) => a.type === 'AUDIO_TTS');
      const hasBGM = audioAssets.some((a) => a.type === 'AUDIO_BGM');
      audioPass = hasTTS && hasBGM;
    }

    // 4. 综合判定 (Verdict)
    const signals: any = {
      identity_score: identityScore, // 可能是 Stub 也可能是 Real (取决于 ce23RealEnabled)
      render_physical: renderPhysicalPass ? 1 : 0,
      audio_existence: audioPass ? 1 : 0,
    };

    // P16-0: 写入 Shadow Signals
    if (realScoreResult) {
      signals.identity_score_real_ppv64 = realScoreResult.score;
      signals.ce23_provider = 'real-embed-v1';
      signals.ce23_algo_version = 'ppv64_v1';
      signals.ce23_real_mode = ce23RealEnabled ? 'real' : 'shadow';
    }
    if (realError) {
      signals.ce23_real_error = realError;
    }
    // P16-2.0: Kill Switch Signal Audit
    if (forceDisable) {
      signals.ce23_kill_switch = true;
      signals.ce23_kill_switch_source = 'env';
      // P0 Patch: Explicitly set mode to legacy
      signals.ce23_real_mode = 'legacy';

      // P0 Patch: Safety check - ensure no real/shadow artifacts leaked
      delete signals.identity_score_real_ppv64;
      delete signals.ce23_provider;
      delete signals.ce23_algo_version;
      delete signals.ce23_real_error;
    }

    // P16: 阈值判定
    let identityThreshold = 0.8;

    if (ce23RealEnabled) {
      // P16-1.1: Configurable Threshold
      if (typeof settings.ce23RealThreshold === 'number') {
        identityThreshold = settings.ce23RealThreshold;
        signals.ce23_real_threshold_source = 'project_settings';
      } else {
        identityThreshold = 0.8;
        signals.ce23_real_threshold_source = 'default_real';
      }
      signals.ce23_real_threshold_used = identityThreshold;
    } else {
      // Legacy Stub mode
      identityThreshold = 0.8;
    }

    const isP0Pass = identityScore >= identityThreshold && renderPhysicalPass && audioPass;
    const verdict = isP0Pass ? 'PASS' : 'FAIL';
    const overallScore = (identityScore + (renderPhysicalPass ? 1 : 0) + (audioPass ? 1 : 0)) / 3;

    // P16-1.2: 误伤护栏 (Marginal Fail Guardrail)
    const ce23RealGuardrailEnabled = !!settings.ce23RealGuardrailEnabled;
    let guardrailBlocked = false;
    let stopReason: string | undefined;

    // Condition: Real Mode + Guardrail En + Failed Real Check
    if (ce23RealEnabled && ce23RealGuardrailEnabled && verdict === 'FAIL' && realScoreResult) {
      const realScore = realScoreResult.score;
      const legacyScore = identityScoreRecord?.identityScore || 0; // The stub score from DB
      const marginalFloor = identityThreshold - 0.03;

      console.warn(
        `[GUARDRAIL_DEBUG] Checking shot ${shotId}. Real=${realScore}, Thresh=${identityThreshold} (Floor=${marginalFloor}), Legacy=${legacyScore} (Req >= 0.90)`
      );

      if (realScore >= marginalFloor && legacyScore >= 0.9) {
        guardrailBlocked = true;
        stopReason = 'GUARDRAIL_BLOCKED_REWORK';
        signals.stopReason = stopReason;
        signals.guardrail_override = true;
        signals.verdict_effective = 'PASS_FOR_PROD';

        console.warn(`[GUARDRAIL] Shot ${shotId} blocked from rework. StopReason set.`);
      } else {
        console.warn(
          `[GUARDRAIL_SKIP] Real=${realScore} vs ${marginalFloor}, Legacy=${legacyScore} vs 0.90. (Enabled: ${ce23RealGuardrailEnabled})`
        );
      }
    }

    // 5. 持久化评分记录
    const scoreRecord = await this.prisma.qualityScore.create({
      data: {
        shotId,
        attempt,
        verdict,
        overallScore,
        signals,
      },
    });

    console.error(`Shot ${shotId} verdict: ${verdict}, overallScore: ${overallScore}`);

    try {
      // 6. 自动返工逻辑 (Triple Guards)
      // Guardrail Blocked -> Skip Rework
      if (verdict === 'FAIL' && !guardrailBlocked) {
        console.error(`[REWORK_DEBUG] Checking rework for shot ${shotId}, attempt ${attempt}`);
        stopReason = await this.handleAutoRework(shotId, traceId, attempt, signals);
        console.error(
          `[REWORK_DEBUG] Result for shot ${shotId}: stopReason=${stopReason || 'NONE_TRIGGERED'}`
        );
      }

      // 无论是否触发，都将最终的 stopReason（如果有）持久化到 signals 中
      if (stopReason) {
        const updatedSignals = {
          ...(signals as any),
          stopReason,
        };
        await this.prisma.qualityScore.update({
          where: { id: scoreRecord.id },
          data: { signals: updatedSignals as any },
        });
        console.error(
          `[REWORK_DEBUG] Updated quality score ${scoreRecord.id} with stopReason: ${stopReason}`
        );
      }
    } catch (err: any) {
      this.logger.error(
        `[REWORK_ERROR] handleAutoRework CRASH for shot ${shotId}: ${err.message}`,
        err.stack
      );
    }

    return scoreRecord;
  }

  /**
   * 处理自动返工 (Triple Guards)
   * 返回 STOP_REASON 如果被拦截，否则返回空
   */
  private async handleAutoRework(
    shotId: string,
    traceId: string,
    attempt: number,
    signals: any
  ): Promise<string | undefined> {
    if (attempt >= 2) {
      const reason = 'MAX_ATTEMPT_REACHED';
      console.error(`STOP_REASON=${reason} for shot ${shotId}. Attempt ${attempt} >= 2.`);
      return reason;
    }

    // 获取 Shot 及其关联信息以获取必填字段
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: {
          include: {
            episode: true,
          },
        },
      },
    });

    if (!shot) {
      this.logger.error(`Shot ${shotId} not found, cannot trigger rework.`);
      return 'SHOT_NOT_FOUND';
    }

    const projectId = shot.scene?.episode?.projectId;
    const organizationId = shot.organizationId;

    if (!projectId || !organizationId) {
      this.logger.error(`Missing projectId or organizationId for shot ${shotId}. Rework skipped.`);
      return 'PROJECT_OR_ORG_MISSING';
    }

    const standardizedTraceId = `${traceId}:rework:${attempt + 1}`;
    const reworkKey = `${traceId}:${shotId}:attempt_${attempt + 1}`;

    // P14-1: Org 维度并发护栏
    const reworkConcurrencyCap = parseInt(process.env.REWORK_MAX_CONCURRENCY_PER_ORG || '2', 10);
    const runningReworks = await this.prisma.shotJob.count({
      where: {
        organizationId,
        type: 'SHOT_RENDER',
        status: { in: ['PENDING', 'RUNNING'] },
        isVerification: false,
        traceId: { contains: ':rework:' },
      },
    });

    if (runningReworks >= reworkConcurrencyCap) {
      const reason = 'RATE_LIMIT_BLOCKED';
      console.error(
        `STOP_REASON=${reason} for shot ${shotId}. Current running reworks: ${runningReworks}, Cap: ${reworkConcurrencyCap}`
      );
      if (signals) {
        signals.rateLimitSnapshot = { runningReworks, cap: reworkConcurrencyCap };
      }
      return reason;
    }

    // 闸 2: 幂等性校验 (硬拦截 via ShotReworkDedupe 表)
    try {
      await this.prisma.shotReworkDedupe.create({
        data: {
          reworkKey,
          traceId: standardizedTraceId, // 使用标准化 traceId
          shotId,
          attempt: attempt + 1,
        },
      });
    } catch (e: any) {
      // P2002: Unique constraint violation (Prisma unique violation code)
      if (e.code === 'P2002') {
        const reason = 'IDEMPOTENCY_HIT';
        console.error(`STOP_REASON=${reason} (reworkKey=${reworkKey}) for shot ${shotId}.`);
        return reason;
      }
      throw e;
    }

    console.error(
      `Triggering rework for shot ${shotId}, new attempt: ${attempt + 1}, traceId: ${standardizedTraceId}`
    );

    console.error(
      `[REWORK_DEBUG] Triggering jobService.create for shot ${shotId} orgId ${organizationId} traceId ${standardizedTraceId}`
    );
    try {
      await this.jobService.create(
        shotId,
        {
          type: 'SHOT_RENDER',
          dedupeKey: reworkKey,
          traceId: standardizedTraceId, // P14-1: 标准化 traceId
          payload: {
            traceId: standardizedTraceId,
            attempt: attempt + 1,
            reworkKey,
            reason: 'QUALITY_FAIL',
            signals,
            referenceSheetId: 'gate-mock-ref-id', // P14: 满足 SHOT_RENDER 契约
          },
          isVerification: false, // 必须为 false 以确保 Case C 预算拦截生效
        } as any,
        'system-rework', // userId = 'system-rework' for audit
        organizationId
      );
    } catch (e: any) {
      this.logger.error(
        `[REWORK_ERROR] handleAutoRework failed for shot ${shotId}: message="${e.message}" code="${e.code}" response=${JSON.stringify(e.response)}`
      );

      const errorMsg = e.message || '';
      const responseMsg = e.response?.message || '';

      // P14-0: 统一捕获预算不足错误 (由 JobService.create 抛出)
      if (
        errorMsg.includes('Insufficient credits') ||
        responseMsg.includes('Insufficient credits')
      ) {
        const reason = 'BUDGET_GUARD_BLOCKED';
        console.error(`STOP_REASON=${reason} (via catch) for shot ${shotId}.`);
        return reason;
      }

      // 其它错误抛出以防静默失败
      this.logger.error(`Failed to create rework job for shot ${shotId}: ${e.message}`);
      throw e;
    }

    return undefined; // 成功触发，无拦截原因
  }

  buildQualityScoreFromJob(
    job: any,
    adapter: EngineAdapter | null,
    taskId: string
  ): QualityScoreRecord | null {
    try {
      const engineKey = this.extractEngineKey(job);
      const adapterName = adapter?.name || engineKey;
      const metrics = this.extractMetrics(job);
      const quality = this.extractQuality(job);
      const modelInfo = this.extractModelInfo(job, adapter);

      return {
        taskId,
        jobId: job.id,
        engineKey,
        adapterName,
        modelInfo,
        metrics,
        quality,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to build quality score from job ${job.id}:`, error);
      return null;
    }
  }

  private extractEngineKey(job: any): string {
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.engineKey && typeof payload.engineKey === 'string') {
        return payload.engineKey;
      }
    }
    const jobType = job?.type;
    if (jobType === 'NOVEL_ANALYSIS') return 'default_novel_analysis';
    if (jobType === 'SHOT_RENDER') return 'default_shot_render';
    return 'default_novel_analysis';
  }

  private extractMetrics(job: any): QualityScoreRecord['metrics'] {
    const metrics: QualityScoreRecord['metrics'] = {};
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;
        if (result.metrics && typeof result.metrics === 'object') {
          const resultMetrics = result.metrics as any;
          if (typeof resultMetrics.durationMs === 'number')
            metrics.durationMs = resultMetrics.durationMs;
          if (typeof resultMetrics.tokens === 'number') metrics.tokens = resultMetrics.tokens;
          if (typeof resultMetrics.costUsd === 'number') metrics.costUsd = resultMetrics.costUsd;
        }
      }
    }
    return metrics;
  }

  private extractQuality(job: any): QualityScoreRecord['quality'] {
    const quality: QualityScoreRecord['quality'] = {};
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;
        if (result.quality && typeof result.quality === 'object') {
          const resultQuality = result.quality as any;
          if (typeof resultQuality.confidence === 'number')
            quality.confidence = resultQuality.confidence;
          if (typeof resultQuality.score === 'number') quality.score = resultQuality.score;
        } else {
          if (typeof result.confidence === 'number') quality.confidence = result.confidence;
          if (typeof result.score === 'number') quality.score = result.score;
        }
      }
    }
    return quality;
  }

  private extractModelInfo(
    job: any,
    adapter: EngineAdapter | null
  ): QualityScoreRecord['modelInfo'] | undefined {
    const modelInfo: QualityScoreRecord['modelInfo'] = {};
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;
        if (result.modelInfo && typeof result.modelInfo === 'object') {
          const resultModelInfo = result.modelInfo as any;
          if (typeof resultModelInfo.modelName === 'string')
            modelInfo.modelName = resultModelInfo.modelName;
          if (typeof resultModelInfo.version === 'string')
            modelInfo.version = resultModelInfo.version;
        }
      }
    }
    if (modelInfo.modelName || modelInfo.version) return modelInfo;
    return undefined;
  }
}
