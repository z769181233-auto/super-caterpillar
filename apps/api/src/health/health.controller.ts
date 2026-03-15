import { Controller, Get, Header } from '@nestjs/common';
import { TextSafetyMetrics } from '../observability/text_safety.metrics';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JobStatus, JobType } from 'database';

@Controller()
export class HealthController {
  private readonly readyProbeTimeoutMs = Number(process.env.HEALTH_READY_TIMEOUT_MS || '3000');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService?: RedisService
  ) { }

  @Get('/health')
  health() {
    return {
      ok: true,
      service: 'api',
      mode: 'real',
      truth_seal: 'sealed',
      missing_envs: (process as any).missingEnvs || [],
      gate_mode: Number(process.env.GATE_MODE) || 0,
      ts: new Date().toISOString()
    };
  }

  @Get('/api/health')
  apiHealth() {
    return {
      ok: true,
      service: 'api',
      status: 'ok',
      mode: 'real',
      truth_seal: 'sealed',
      missing_envs: (process as any).missingEnvs || [],
      gate_mode: Number(process.env.GATE_MODE) || 0,
      ts: new Date().toISOString()
    };
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
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: this.readyProbeTimeoutMs,
        query_timeout: this.readyProbeTimeoutMs,
      });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
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
