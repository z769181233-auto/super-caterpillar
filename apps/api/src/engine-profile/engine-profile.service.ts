import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import type {
  EngineProfileQuery,
  EngineProfileSummary,
  EngineProfileResponse,
} from '@scu/shared-types';

/**
 * S4-A: 引擎画像服务
 * 
 * 从历史 Job 数据中聚合引擎统计信息，生成引擎画像
 * 只读服务，不修改任何数据
 */
@Injectable()
export class EngineProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly engineRegistry: EngineRegistry,
    private readonly engineConfigStore: EngineConfigStoreService,
  ) {}

  /**
   * 获取引擎画像统计摘要
   */
  async getProfileSummary(query: EngineProfileQuery): Promise<EngineProfileResponse> {
    // 构建时间范围过滤条件
    const timeFilter: any = {};
    if (query.from) {
      timeFilter.gte = new Date(query.from);
    }
    if (query.to) {
      timeFilter.lte = new Date(query.to);
    }

    // 构建基础查询条件
    const where: any = {};
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.from || query.to) {
      where.createdAt = timeFilter;
    }

    // 查询所有符合条件的 Job
    const jobs = await this.prisma.shotJob.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        payload: true,
        engineConfig: true,
        retryCount: true,
        createdAt: true,
      },
    });

    // 按 engineKey 分组聚合
    const engineMap = new Map<string, {
      engineKey: string;
      engineVersion: string | null;
      adapterName: string | null;
      jobs: any[];
    }>();

    for (const job of jobs) {
      // 使用 JobService 的统一方法提取引擎信息
      const engineKey = this.jobService.extractEngineKeyFromJob(job);
      const engineVersion = this.jobService.extractEngineVersionFromJob(job);

      // 获取适配器名称
      let adapterName: string | null = null;
      try {
        const adapter = this.engineRegistry.getAdapter(engineKey);
        if (adapter) {
          adapterName = adapter.name;
        } else {
          const engineConfig = await this.engineConfigStore.findByEngineKey(engineKey);
          if (engineConfig?.adapterName) {
            adapterName = engineConfig.adapterName;
          } else {
            adapterName = engineKey;
          }
        }
      } catch {
        adapterName = engineKey;
      }

      // 如果指定了 engineKey 过滤，只处理匹配的
      if (query.engineKey && engineKey !== query.engineKey) {
        continue;
      }

      const key = `${engineKey}::${engineVersion || 'null'}`;
      if (!engineMap.has(key)) {
        engineMap.set(key, {
          engineKey,
          engineVersion,
          adapterName,
          jobs: [],
        });
      }
      engineMap.get(key)!.jobs.push(job);
    }

    // 聚合统计数据
    const summaries: EngineProfileSummary[] = [];

    for (const [key, group] of engineMap.entries()) {
      const jobs = group.jobs;
      const totalJobs = jobs.length;

      // 统计状态
      const successCount = jobs.filter(j => j.status === 'SUCCEEDED').length;
      const failedCount = jobs.filter(j => j.status === 'FAILED').length;
      const retryCount = jobs.reduce((sum, j) => sum + (j.retryCount || 0), 0);

      // 提取质量指标和性能指标
      const qualityScores: number[] = [];
      const confidences: number[] = [];
      const durations: number[] = [];
      const tokens: number[] = [];
      const costs: number[] = [];

      for (const job of jobs) {
        if (job.payload && typeof job.payload === 'object') {
          const payload = job.payload as any;
          const result = payload.result;

          if (result?.quality?.score !== null && result?.quality?.score !== undefined) {
            qualityScores.push(Number(result.quality.score));
          }
          if (result?.quality?.confidence !== null && result?.quality?.confidence !== undefined) {
            confidences.push(Number(result.quality.confidence));
          }
          if (result?.metrics?.durationMs !== null && result?.metrics?.durationMs !== undefined) {
            durations.push(Number(result.metrics.durationMs));
          }
          if (result?.metrics?.tokens !== null && result?.metrics?.tokens !== undefined) {
            tokens.push(Number(result.metrics.tokens));
          }
          if (result?.metrics?.costUsd !== null && result?.metrics?.costUsd !== undefined) {
            costs.push(Number(result.metrics.costUsd));
          }
        }
      }

      // 计算平均值
      const avgQualityScore = qualityScores.length > 0
        ? qualityScores.reduce((sum, v) => sum + v, 0) / qualityScores.length
        : null;
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length
        : null;
      const avgDurationMs = durations.length > 0
        ? durations.reduce((sum, v) => sum + v, 0) / durations.length
        : null;
      const avgTokens = tokens.length > 0
        ? tokens.reduce((sum, v) => sum + v, 0) / tokens.length
        : null;
      const avgCostUsd = costs.length > 0
        ? costs.reduce((sum, v) => sum + v, 0) / costs.length
        : null;

      // 计算成功率
      const successRate = totalJobs > 0 ? successCount / totalJobs : null;

      summaries.push({
        engineKey: group.engineKey,
        engineVersion: group.engineVersion,
        adapterName: group.adapterName,
        totalJobs,
        successCount,
        failedCount,
        retryCount,
        avgQualityScore,
        avgConfidence,
        avgDurationMs,
        avgTokens,
        avgCostUsd,
        successRate,
      });
    }

    return {
      summaries,
      total: summaries.length,
    };
  }
}

