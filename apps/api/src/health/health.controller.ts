import { Controller, Get, Header } from '@nestjs/common';
import { TextSafetyMetrics } from '../observability/text_safety.metrics';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JobStatus, JobType } from 'database';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService?: RedisService
  ) { }

  @Get('/health')
  health() {
    return { ok: true, service: 'api', ts: new Date().toISOString() };
  }

  @Get('/api/health')
  apiHealth() {
    return { ok: true, service: 'api', status: 'ok', ts: new Date().toISOString() };
  }

  @Get('/health/live')
  live() {
    // 进程活着即 200
    return { ok: true, status: 'alive', ts: new Date().toISOString() };
  }

  @Get('/health/ready')
  async ready() {
    // 检查 DB/Redis 连接
    const checks: Record<string, boolean | null> = {};
    let allReady = true;

    // 检查数据库连接
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      checks.database = false;
      allReady = false;
    }

    // 检查 Redis 连接（如果可用）
    if (this.redisService) {
      // RedisService 有 isConnected 属性
      checks.redis = (this.redisService as any).isConnected || false;
    } else {
      checks.redis = null; // Redis 服务未配置
    }

    return {
      ok: allReady,
      status: allReady ? 'ready' : 'not_ready',
      checks,
      ts: new Date().toISOString(),
    };
  }

  @Get('/health/gpu')
  gpu() {
    // 如果当前不具备 GPU 探测条件，返回 { available: false, reason } 但必须 200
    return {
      available: false,
      reason: 'GPU detection not implemented',
      ts: new Date().toISOString(),
    };
  }

  @Get('/ping')
  ping() {
    return { ok: true, pong: true, ts: new Date().toISOString() };
  }

  @Get('/metrics')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async metrics() {
    const uptime = process.uptime();
    const node = process.version;
    const memUsage = process.memoryUsage();

    // 收集 Job 统计信息
    const [totalJobs, pendingJobs, runningJobs, failedJobs, videoRenderPending] = await Promise.all(
      [
        this.prisma.shotJob.count(),
        this.prisma.shotJob.count({ where: { status: JobStatus.PENDING } }),
        this.prisma.shotJob.count({ where: { status: JobStatus.RUNNING } }),
        this.prisma.shotJob.count({ where: { status: JobStatus.FAILED } }),
        this.prisma.shotJob.count({
          where: {
            type: JobType.VIDEO_RENDER,
            status: JobStatus.PENDING,
          },
        }),
      ]
    );

    // P5-1: Unified Scrape - Include Worker Metrics
    let workerMetrics = '';
    const workerMetricsPort = process.env.WORKER_METRICS_PORT || 3001;
    try {
      // Use dynamic import for axios to avoid static dependency in health check
      const axios = (await import('axios')).default;
      const workerResp = await axios.get(`http://127.0.0.1:${workerMetricsPort}/metrics`, {
        timeout: 500,
        validateStatus: (status) => status === 200
      });
      workerMetrics = '\n\n# --- Worker Metrics ---\n' + workerResp.data;
    } catch (e) {
      workerMetrics = '\n\n# --- Worker Metrics Unavailable ---';
    }

    // Prometheus 格式的指标
    return `# scu_api_metrics
# HELP scu_api_uptime_seconds API server uptime in seconds
# TYPE scu_api_uptime_seconds gauge
scu_api_uptime_seconds ${uptime}

# HELP scu_api_node_version Node.js version
# TYPE scu_api_node_version gauge
scu_api_node_version{version="${node}"} 1

# HELP scu_api_memory_heap_used_bytes Heap memory used in bytes
# TYPE scu_api_memory_heap_used_bytes gauge
scu_api_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP scu_api_memory_heap_total_bytes Total heap memory in bytes
# TYPE scu_api_memory_heap_total_bytes gauge
scu_api_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP scu_api_memory_rss_bytes Resident set size in bytes
# TYPE scu_api_memory_rss_bytes gauge
scu_api_memory_rss_bytes ${memUsage.rss}

# HELP scu_api_jobs_total Total number of jobs
# TYPE scu_api_jobs_total gauge
scu_api_jobs_total ${totalJobs}

# HELP scu_api_jobs_pending Number of pending jobs
# TYPE scu_api_jobs_pending gauge
scu_api_jobs_pending ${pendingJobs}

# HELP scu_api_jobs_running Number of running jobs
# TYPE scu_api_jobs_running gauge
scu_api_jobs_running ${runningJobs}

# HELP scu_api_jobs_failed Number of failed jobs
# TYPE scu_api_jobs_failed gauge
scu_api_jobs_failed ${failedJobs}

# HELP scu_api_jobs_video_render_pending Number of pending VIDEO_RENDER jobs
# TYPE scu_api_jobs_video_render_pending gauge
scu_api_jobs_video_render_pending ${videoRenderPending}

${TextSafetyMetrics.getPrometheusOutput()}

${workerMetrics}
`;
  }

  // 兼容 smoke：/api/health/ready /api/health/live /api/health/gpu
  @Get('/api/health/ready')
  readyAlias() {
    return this.ready();
  }

  @Get('/api/health/live')
  liveAlias() {
    return this.live();
  }

  @Get('/api/health/gpu')
  gpuAlias() {
    return this.gpu();
  }
}
