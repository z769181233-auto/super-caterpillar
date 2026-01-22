import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EXEC-P11-1.1: Ops 指标聚合服务 (只读)
 */
@Injectable()
export class OpsMetricsService {
  private readonly logger = new Logger(OpsMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProductionMetrics() {
    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Job Success Rate (Last 15m)
    const recentJobs = await this.prisma.shotJob.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: fifteenMinsAgo },
      },
      _count: true,
    });

    const totalRecent = recentJobs.reduce((acc, cr) => acc + cr._count, 0);
    const succeededRecent = recentJobs.find((r) => r.status === 'SUCCEEDED')?._count || 0;
    const job_success_rate_15m = totalRecent > 0 ? (succeededRecent / totalRecent) * 100 : 100;

    // 2. Job Counts by Type (Last 24h)
    const jobCountsByType = await this.prisma.shotJob.groupBy({
      by: ['type'],
      where: { createdAt: { gte: twentyFourHoursAgo } },
      _count: true,
    });
    const job_counts_by_type = jobCountsByType.reduce(
      (acc, curr) => {
        acc[curr.type] = curr._count;
        return acc;
      },
      {} as Record<string, number>
    );

    // 3. Queue Depth & Oldest Pending
    const queueDepth = await this.prisma.shotJob.count({
      where: { status: { in: ['PENDING', 'DISPATCHED'] } },
    });

    const oldestPendingJob = await this.prisma.shotJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    const oldest_pending_age_ms = oldestPendingJob
      ? now.getTime() - oldestPendingJob.createdAt.getTime()
      : 0;

    // 4. Cost and Published (Simplified proxy)
    const costByEngine = await this.prisma.jobEngineBinding.groupBy({
      by: ['engineKey'],
      where: {
        status: 'COMPLETED',
        completedAt: { gte: twentyFourHoursAgo },
      },
      _count: true, // Placeholder for real credits if not in schema
    });

    const publishedCount = await this.prisma.publishedVideo.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    });

    return {
      job_success_rate_15m: Number(job_success_rate_15m.toFixed(2)),
      job_counts_by_type,
      queue_depth: queueDepth,
      oldest_pending_age_ms,
      published_assets_24h: publishedCount,
      cost_by_engineKey_24h: costByEngine.reduce(
        (acc, curr) => {
          acc[curr.engineKey] = curr._count; // Assuming 1 job = 1 unit for now
          return acc;
        },
        {} as Record<string, number>
      ),
      timestamp: now.toISOString(),
    };
  }
}
