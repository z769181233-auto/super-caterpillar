import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobType as JobTypeEnum } from 'database';

/**
 * Quality Metrics Writer
 * 质量指标写入服务（只启用写入，不启用阻断）
 * 
 * 规则：
 * - CE03/CE04 执行完成后必须写 QualityMetrics
 * - 暂不阻断、不回滚、不打分裁决，只是为后续自动优化留钩子
 * - 写入失败不得影响主流程，但必须 logger.error + 可选写审计
 */
@Injectable()
export class QualityMetricsWriter {
  private readonly logger = new Logger(QualityMetricsWriter.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 写入质量指标
   * 
   * @param params 写入参数
   * @returns 是否写入成功
   */
  async writeQualityMetrics(params: {
    jobId: string;
    jobType: string;
    projectId: string;
    traceId?: string;
    result?: any;
  }): Promise<boolean> {
    try {
      const { jobId, jobType, projectId, traceId, result } = params;

      // 只处理 CE03 和 CE04
      if (jobType !== JobTypeEnum.CE03_VISUAL_DENSITY && jobType !== JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
        return false;
      }

      const resultPayload = result || {};
      const engine = jobType === JobTypeEnum.CE03_VISUAL_DENSITY ? 'CE03' : 'CE04';

      // 提取质量指标
      let visualDensityScore: number | undefined;
      let enrichmentQuality: number | undefined;
      let metadata: any = {};

      if (jobType === JobTypeEnum.CE03_VISUAL_DENSITY) {
        // CE03 输出：visual_density_score
        visualDensityScore =
          resultPayload.visualDensityScore ||
          resultPayload.visual_density_score ||
          resultPayload.score ||
          undefined;
        // metadata 将在后续统一添加 jobId/traceId/engineKey
        metadata = {
          ...resultPayload,
        };
      } else if (jobType === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
        // CE04 输出：enrichment_quality
        enrichmentQuality =
          resultPayload.enrichmentQuality ||
          resultPayload.enrichment_quality ||
          resultPayload.quality ||
          undefined;
        // metadata 将在后续统一添加 jobId/traceId/engineKey
        metadata = {
          ...resultPayload,
        };
      }

      // 写入 QualityMetrics（如果指标存在）
      // 规则：每次 SUCCEEDED 都 create 一条新记录，避免丢失历史
      if (visualDensityScore !== undefined || enrichmentQuality !== undefined) {
        // 确保 metadata 包含必要字段（jobId/traceId/engineKey），避免丢失历史
        const finalMetadata = {
          ...metadata,
          jobId, // 必含：用于追溯具体 Job
          traceId: traceId || undefined, // 必含：用于追溯 Pipeline
          engineKey: engine === 'CE03' ? 'ce03_visual_density' : 'ce04_visual_enrichment', // 必含：用于追溯引擎
        };

        // 每次 SUCCEEDED 都创建新记录（不覆盖历史）
        await this.prisma.qualityMetrics.create({
          data: {
            projectId,
            engine,
            visualDensityScore,
            enrichmentQuality,
            metadata: finalMetadata,
          },
        });

        this.logger.log(`QualityMetrics created for ${engine} job ${jobId}, project ${projectId} (traceId: ${traceId || 'N/A'})`);
        return true;
      } else {
        this.logger.warn(
          `No quality metrics found in result for ${engine} job ${jobId}, skipping QualityMetrics write`,
        );
        return false;
      }
    } catch (error: any) {
      // 质量指标写入失败不影响主流程
      this.logger.error(
        `Failed to write QualityMetrics for job ${params.jobId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}

