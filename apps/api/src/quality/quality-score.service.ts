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

@Injectable()
export class QualityScoreService {
  private readonly logger = new Logger(QualityScoreService.name);

  constructor() {}

  /**
   * 从 Job 和 Adapter 构建 QualityScoreRecord
   * @param job Job 对象（包含 payload）
   * @param adapter EngineAdapter 实例
   * @param taskId Task ID
   * @returns QualityScoreRecord 或 null（如果无法构建）
   */
  buildQualityScoreFromJob(
    job: any,
    adapter: EngineAdapter | null,
    taskId: string
  ): QualityScoreRecord | null {
    try {
      // 1. 提取 engineKey
      const engineKey = this.extractEngineKey(job);

      // 2. 提取 adapterName
      const adapterName = adapter?.name || engineKey;

      // 3. 提取 metrics（从 job.payload.result.metrics）
      const metrics = this.extractMetrics(job);

      // 4. 提取 quality（从 job.payload.result.quality 或 job.payload.result）
      const quality = this.extractQuality(job);

      // 5. 提取 modelInfo（从 adapter 或 job.payload）
      const modelInfo = this.extractModelInfo(job, adapter);

      // 6. 构建 QualityScoreRecord
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
      this.logger.warn(`Failed to build quality score from job ${job.id}:`, error);
      return null;
    }
  }

  /**
   * 从 Job 中提取 engineKey
   * 优先级：job.payload.engineKey > 默认引擎
   */
  private extractEngineKey(job: any): string {
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.engineKey && typeof payload.engineKey === 'string') {
        return payload.engineKey;
      }
    }

    // 降级：根据 jobType 返回默认引擎
    const jobType = job?.type;
    if (jobType === 'NOVEL_ANALYSIS') {
      return 'default_novel_analysis';
    }
    if (jobType === 'SHOT_RENDER') {
      return 'default_shot_render';
    }

    return 'default_novel_analysis';
  }

  /**
   * 从 Job 中提取 metrics
   * 从 job.payload.result.metrics 读取
   */
  private extractMetrics(job: any): QualityScoreRecord['metrics'] {
    const metrics: QualityScoreRecord['metrics'] = {};

    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;
        if (result.metrics && typeof result.metrics === 'object') {
          const resultMetrics = result.metrics as any;
          if (typeof resultMetrics.durationMs === 'number') {
            metrics.durationMs = resultMetrics.durationMs;
          }
          if (typeof resultMetrics.tokens === 'number') {
            metrics.tokens = resultMetrics.tokens;
          }
          if (typeof resultMetrics.costUsd === 'number') {
            metrics.costUsd = resultMetrics.costUsd;
          }
        }
      }
    }

    return metrics;
  }

  /**
   * 从 Job 中提取 quality
   * 从 job.payload.result.quality 或 job.payload.result 读取
   */
  private extractQuality(job: any): QualityScoreRecord['quality'] {
    const quality: QualityScoreRecord['quality'] = {};

    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;

        // 优先从 result.quality 读取
        if (result.quality && typeof result.quality === 'object') {
          const resultQuality = result.quality as any;
          if (typeof resultQuality.confidence === 'number') {
            quality.confidence = resultQuality.confidence;
          }
          if (typeof resultQuality.score === 'number') {
            quality.score = resultQuality.score;
          }
        } else {
          // 降级：直接从 result 读取
          if (typeof result.confidence === 'number') {
            quality.confidence = result.confidence;
          }
          if (typeof result.score === 'number') {
            quality.score = result.score;
          }
        }
      }
    }

    return quality;
  }

  /**
   * 从 Job 和 Adapter 中提取 modelInfo
   */
  private extractModelInfo(
    job: any,
    adapter: EngineAdapter | null
  ): QualityScoreRecord['modelInfo'] | undefined {
    const modelInfo: QualityScoreRecord['modelInfo'] = {};

    // 1. 优先从 job.payload.result.modelInfo 读取
    if (job?.payload && typeof job.payload === 'object') {
      const payload = job.payload as any;
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as any;
        if (result.modelInfo && typeof result.modelInfo === 'object') {
          const resultModelInfo = result.modelInfo as any;
          if (typeof resultModelInfo.modelName === 'string') {
            modelInfo.modelName = resultModelInfo.modelName;
          }
          if (typeof resultModelInfo.version === 'string') {
            modelInfo.version = resultModelInfo.version;
          }
        }
      }
    }

    // 2. 如果 modelInfo 为空，尝试从 adapter 获取（如果 adapter 有相关方法）
    // 注意：当前 EngineAdapter 接口没有 modelInfo 方法，暂时跳过

    // 3. 如果 modelInfo 有值，返回；否则返回 undefined
    if (modelInfo.modelName || modelInfo.version) {
      return modelInfo;
    }

    return undefined;
  }
}
