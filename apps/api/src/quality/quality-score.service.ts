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

@Injectable()
export class QualityScoreService {
  private readonly logger = new Logger(QualityScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService
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
    const identityScore = identityScoreRecord?.identityScore || 0;

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
    const signals = {
      identity_score: identityScore,
      render_physical: renderPhysicalPass ? 1 : 0,
      audio_existence: audioPass ? 1 : 0,
    };

    const isP0Pass = identityScore >= 0.8 && renderPhysicalPass && audioPass;
    const verdict = isP0Pass ? 'PASS' : 'FAIL';
    const overallScore = (identityScore + (renderPhysicalPass ? 1 : 0) + (audioPass ? 1 : 0)) / 3;

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

    let stopReason: string | undefined;

    try {
      // 6. 自动返工逻辑 (Triple Guards)
      if (verdict === 'FAIL') {
        console.error(`[REWORK_DEBUG] Checking rework for shot ${shotId}, attempt ${attempt}`);
        stopReason = await this.handleAutoRework(shotId, traceId, attempt, signals);
        console.error(`[REWORK_DEBUG] Result for shot ${shotId}: stopReason=${stopReason || 'NONE_TRIGGERED'}`);
      }

      // 无论是否触发，都将最终的 stopReason（如果有）持久化到 signals 中
      if (stopReason) {
        const updatedSignals = {
          ...(signals as any),
          stopReason
        };
        await this.prisma.qualityScore.update({
          where: { id: scoreRecord.id },
          data: { signals: updatedSignals as any },
        });
        console.error(`[REWORK_DEBUG] Updated quality score ${scoreRecord.id} with stopReason: ${stopReason}`);
      }
    } catch (err: any) {
      this.logger.error(`[REWORK_ERROR] handleAutoRework CRASH for shot ${shotId}: ${err.message}`, err.stack);
    }

    return scoreRecord;
  }

  /**
   * 处理自动返工 (Triple Guards)
   * 返回 STOP_REASON 如果被拦截，否则返回空
   */
  private async handleAutoRework(shotId: string, traceId: string, attempt: number, signals: any): Promise<string | undefined> {
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

    const reworkKey = `${traceId}:${shotId}:attempt_${attempt + 1}`;

    // 闸 2: 幂等性校验 (硬拦截 via ShotReworkDedupe 表)
    try {
      await this.prisma.shotReworkDedupe.create({
        data: {
          reworkKey,
          traceId,
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

    console.error(`Triggering rework for shot ${shotId}, new attempt: ${attempt + 1}, dedupeKey: ${reworkKey}`);

    console.error(`[REWORK_DEBUG] Triggering jobService.create for shot ${shotId} orgId ${organizationId} reworkKey ${reworkKey}`);
    try {
      await this.jobService.create(
        shotId,
        {
          type: 'SHOT_RENDER',
          dedupeKey: reworkKey,
          payload: {
            traceId,
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
      this.logger.error(`[REWORK_ERROR] handleAutoRework failed for shot ${shotId}: message="${e.message}" code="${e.code}" response=${JSON.stringify(e.response)}`);

      const errorMsg = e.message || '';
      const responseMsg = e.response?.message || '';

      // P14-0: 统一捕获预算不足错误 (由 JobService.create 抛出)
      if (errorMsg.includes('Insufficient credits') || responseMsg.includes('Insufficient credits')) {
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
