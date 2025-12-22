import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { JobStatus as JobStatusEnum } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from './job.service';
import { env } from 'config';

@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => JobService)) private readonly jobService: JobService
  ) { }

  async onModuleInit() {
    if ((env as any).enableInternalJobWorker) {
      this.logger.log(`Job Worker enabled, starting with interval ${(env as any).jobWorkerInterval}ms`);

      // P0-4: 自动注册或更新内置 Worker 节点信息，确保 getAndMarkNextPendingJob 能领到任务
      await this.prisma.workerNode.upsert({
        where: { workerId: 'internal-api-worker' },
        update: {
          status: 'online', // Prisma 枚举通常为小写或严格匹配
          lastHeartbeat: new Date(),
          capabilities: { supportedEngines: ['default_novel_analysis', 'default_shot_render', 'default_video_render'] },
        },
        create: {
          workerId: 'internal-api-worker',
          name: 'Internal API Worker',
          status: 'online',
          lastHeartbeat: new Date(),
          capabilities: { supportedEngines: ['default_novel_analysis', 'default_shot_render', 'default_video_render'] },
        },
      });

      this.start();
    } else {
      this.logger.warn('Job Worker is disabled (JOB_WORKER_ENABLED=false)');
    }
  }

  onModuleDestroy() {
    this.stop();
  }

  private start() {
    // 立即执行一次
    this.processJobs();

    // 设置定时器
    this.intervalId = setInterval(() => {
      this.processJobs();
    }, (env as any).jobWorkerInterval);
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Job Worker stopped');
    }
  }

  private async processJobs() {
    // 防止并发执行
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // P0-4: 必须使用原子性领取，禁止 findMany + 内存过滤
      // 我们循环领取，直到达到 batchSize 或没有更多任务
      const batchSize = (env as any).jobWorkerBatchSize || 10;
      const claimedJobs = [];

      for (let i = 0; i < batchSize; i++) {
        // 使用 JobService 封装的 FOR UPDATE SKIP LOCKED 原子方法
        // internal worker 标识为 'internal-api-worker'
        const job = await this.jobService.getAndMarkNextPendingJob('internal-api-worker');
        if (!job) break;
        claimedJobs.push(job);
      }

      if (claimedJobs.length === 0) {
        return;
      }

      this.logger.log(`[P0-4] Internal worker claimed ${claimedJobs.length} jobs atomically.`);

      // 并发处理已领取的 Jobs
      const processingPromises = claimedJobs.map((job: any) =>
        this.jobService.processJob(job.id).catch((error: any) => {
          this.logger.error(`Failed to process job ${job.id}:`, error);
        })
      );

      await Promise.all(processingPromises);

    } catch (error: any) {
      this.logger.error('Error in Job Worker:', error.stack || error.message || error);
    } finally {
      this.isProcessing = false;
    }
  }
}











