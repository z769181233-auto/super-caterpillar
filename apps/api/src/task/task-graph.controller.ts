import { Controller, Get, Param } from '@nestjs/common';
import { TaskGraphService } from './task-graph.service';
import { QualityScoreService } from '../quality/quality-score.service';
import { QualityFeedbackService } from '../quality/quality-feedback.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { randomUUID } from 'crypto';

@Controller('tasks')
export class TaskGraphController {
  constructor(
    private readonly taskGraphService: TaskGraphService,
    private readonly qualityScoreService: QualityScoreService,
    private readonly qualityFeedbackService: QualityFeedbackService,
    private readonly engineRegistry: EngineRegistry,
    private readonly engineConfigStore: EngineConfigStoreService,
    private readonly prisma: PrismaService,
    private readonly jobService: JobService // S3-C.3: 注入 JobService 以使用统一的引擎信息提取方法
  ) {}

  @Get(':taskId/graph')
  async getTaskGraph(@Param('taskId') taskId: string) {
    const graph = await this.taskGraphService.findTaskGraph(taskId);

    if (!graph) {
      return {
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task ${taskId} not found`,
        },
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    }

    // 构建 qualityScores：对 graph.jobs 循环，解析 engineKey → adapter，调用 QualityScoreService
    const qualityScores = await this.buildQualityScores(taskId, graph.jobs);

    // 构建 qualityFeedback：评估 qualityScores
    const qualityFeedback = this.qualityFeedbackService.evaluateQualityScores(qualityScores);

    // S3-C.3: 为 graph.jobs 添加完整的引擎信息、质量指标和性能指标
    const jobsWithEngineInfo = await this.enrichJobsWithEngineInfo(graph.jobs, qualityScores);

    return {
      success: true,
      data: {
        ...graph,
        jobs: jobsWithEngineInfo,
        qualityScores,
        qualityFeedback,
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * S3-C.3: 为 jobs 添加完整的引擎信息、质量指标和性能指标
   */
  private async enrichJobsWithEngineInfo(jobs: any[], qualityScores: any[]): Promise<any[]> {
    const jobIds = jobs.map((job) => job.jobId);
    if (jobIds.length === 0) {
      return jobs;
    }

    const rawJobs = await this.prisma.shotJob.findMany({
      where: {
        id: { in: jobIds },
      },
    });

    const jobMap = new Map(rawJobs.map((job: any) => [job.id, job]));
    // 构建 qualityScore 映射：jobId -> qualityScore
    const qualityScoreMap = new Map(qualityScores.map((qs) => [qs.jobId, qs]));

    return Promise.all(
      jobs.map(async (jobNode) => {
        const rawJob = jobMap.get(jobNode.jobId);
        if (!rawJob) {
          // 如果没有原始 Job 数据，返回基础节点（引擎信息设为默认值）
          return {
            ...jobNode,
            engineKey: 'default_novel_analysis',
            engineVersion: null,
            adapterName: 'default_novel_analysis',
            qualityScore: null,
            metrics: null,
          };
        }

        // S3-C.3: 使用 JobService 的统一方法提取引擎信息
        const engineKey = this.jobService.extractEngineKeyFromJob(rawJob);
        const engineVersion = this.jobService.extractEngineVersionFromJob(rawJob);
        const adapter = this.engineRegistry.getAdapter(engineKey);
        let adapterName = adapter?.name || engineKey;

        // 如果 adapter 不存在，尝试从 engine 配置获取
        if (!adapter) {
          const engineConfig = await this.engineConfigStore.findByEngineKey(engineKey);
          if (engineConfig?.adapterName) {
            adapterName = engineConfig.adapterName;
          }
        }

        // S3-C.3: 从 qualityScores 数组中匹配对应的 qualityScore 和 metrics
        const qualityScoreRecord = qualityScoreMap.get(jobNode.jobId);
        const qualityScore = qualityScoreRecord
          ? {
              score: qualityScoreRecord.quality?.score ?? null,
              confidence: qualityScoreRecord.quality?.confidence ?? null,
            }
          : null;

        const metrics = qualityScoreRecord
          ? {
              durationMs: qualityScoreRecord.metrics?.durationMs ?? null,
              costUsd: qualityScoreRecord.metrics?.costUsd ?? null,
              tokens: qualityScoreRecord.metrics?.tokens ?? null,
            }
          : null;

        return {
          ...jobNode,
          // S3-C.3: 引擎信息（统一字段）
          engineKey,
          engineVersion,
          adapterName,
          // S3-C.3: 质量指标（统一字段）
          qualityScore,
          // S3-C.3: 性能指标（统一字段）
          metrics,
        };
      })
    );
  }

  /**
   * 为 graph.jobs 构建 qualityScores
   */
  private async buildQualityScores(taskId: string, jobs: any[]): Promise<any[]> {
    // 1. 查询原始 Job 数据（包含 payload）
    const jobIds = jobs.map((job) => job.jobId);
    if (jobIds.length === 0) {
      return [];
    }

    const rawJobs = await this.prisma.shotJob.findMany({
      where: {
        id: { in: jobIds },
      },
    });

    // 2. 为每个 Job 构建 QualityScoreRecord
    const qualityScores: any[] = [];

    for (const job of rawJobs) {
      // 2.1 提取 engineKey（S3-C.3: 使用 JobService 的统一方法）
      const engineKey = this.jobService.extractEngineKeyFromJob(job);

      // 2.2 获取 adapter
      const adapter = this.engineRegistry.getAdapter(engineKey);

      // 2.3 构建 QualityScoreRecord
      const qualityScore = this.qualityScoreService.buildQualityScoreFromJob(job, adapter, taskId);

      if (qualityScore) {
        qualityScores.push(qualityScore);
      }
    }

    return qualityScores;
  }
}
