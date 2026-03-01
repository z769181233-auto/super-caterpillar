import { Controller, Get, Param } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService
  ) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024), // 增加到 1GB 以应对极限压测
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            database: {
              status: 'up',
            },
          };
        } catch (e) {
          throw new HealthCheckError('Database check failed', {
            database: {
              status: 'down',
              message: e.message,
            },
          });
        }
      },
    ]);
  }

  @Get('projects/:projectId/batch-progress')
  async getBatchProgress(@Param('projectId') projectId: string) {
    const counts = await this.prisma.shotJob.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const metricsMap = counts.reduce(
      (acc, curr) => {
        acc[curr.status.toLowerCase()] = curr._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      projectId,
      timestamp: Date.now(),
      succeeded: metricsMap['succeeded'] || 0,
      failed: metricsMap['failed'] || 0,
      pending:
        (metricsMap['pending'] || 0) + (metricsMap['creating'] || 0) + (metricsMap['running'] || 0),
    };
  }
}
