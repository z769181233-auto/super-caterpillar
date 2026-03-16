import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from 'database';

function isCiOrGateContextEnv(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.CI === '1' ||
    !!process.env.JEST_WORKER_ID ||
    process.env.GATE_ENV_MODE === 'ci'
  );
}

function buildPrismaDatasourceUrl(
  rawUrl: string | undefined,
  connectTimeoutMs: number,
  queryTimeoutMs: number
): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    const connectTimeoutSec = String(Math.max(1, Math.ceil(connectTimeoutMs / 1000)));
    const poolTimeoutSec = String(Math.max(1, Math.ceil(queryTimeoutMs / 1000)));

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', connectTimeoutSec);
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', poolTimeoutSec);
    }
    if (!url.searchParams.has('application_name')) {
      url.searchParams.set('application_name', 'super-caterpillar-api');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectTimeoutMs: number;
  private readonly queryTimeoutMs: number;
  private readonly slowQueryWarnMs: number;

  constructor() {
    const ciOrGate = isCiOrGateContextEnv();
    const connectTimeoutMs = Number(
      process.env.PRISMA_CONNECT_TIMEOUT_MS || (ciOrGate ? '5000' : '15000')
    );
    const queryTimeoutMs = Number(
      process.env.PRISMA_QUERY_TIMEOUT_MS || (ciOrGate ? '5000' : '15000')
    );
    const slowQueryWarnMs = Number(
      process.env.PRISMA_SLOW_QUERY_WARN_MS || (ciOrGate ? '1000' : '2000')
    );
    const prismaDatasourceUrl = buildPrismaDatasourceUrl(
      process.env.DATABASE_URL,
      connectTimeoutMs,
      queryTimeoutMs
    );

    super(
      prismaDatasourceUrl
        ? {
            datasources: {
              db: {
                url: prismaDatasourceUrl,
              },
            },
          }
        : {}
    );

    this.connectTimeoutMs = connectTimeoutMs;
    this.queryTimeoutMs = queryTimeoutMs;
    this.slowQueryWarnMs = slowQueryWarnMs;

    this.$use(async (params, next) => {
      const startedAt = Date.now();
      try {
        const result = this.shouldEnforceClientQueryTimeout()
          ? await this.withTimeout(
              () => next(params),
              this.queryTimeoutMs,
              `PRISMA_QUERY_TIMEOUT: ${params.model || '$raw'}.${params.action} exceeded ${this.queryTimeoutMs}ms`
            )
          : await next(params);

        const durationMs = Date.now() - startedAt;
        if (durationMs >= this.slowQueryWarnMs) {
          this.logger.warn(
            `[PrismaService] Slow query detected: ${params.model || '$raw'}.${params.action} took ${durationMs}ms`
          );
        }
        return result;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        this.logger.warn(
          `[PrismaService] Query failed after ${durationMs}ms: ${params.model || '$raw'}.${params.action} -> ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    });

    if (this.shouldEnforceClientQueryTimeout()) {
      this.logger.warn(
        `[PrismaService] Client-side Prisma query timeout wrapper enabled (${this.queryTimeoutMs}ms) in CI/test/gate mode`
      );
    } else {
      this.logger.log(
        `[PrismaService] Client-side Prisma query timeout wrapper disabled in normal runtime; relying on real DB/engine failures instead`
      );
    }
    this.logger.log(
      `[PrismaService] Slow query warning threshold set to ${this.slowQueryWarnMs}ms`
    );
    if (prismaDatasourceUrl && prismaDatasourceUrl !== process.env.DATABASE_URL) {
      this.logger.log(
        `[PrismaService] Applied datasource URL tuning for Prisma client (connect_timeout/pool_timeout/application_name)`
      );
    }
    // 开发/测试环境：诊断 Prisma Client 来源和模型
    if (process.env.NODE_ENV !== 'production') {
      try {
        // eslint-disable-next-line no-console
        this.logger.log('[PrismaService] Prisma Client 诊断信息:', {
          prismaClientSource: this.constructor.name,
          prismaClientPath: require.resolve('database'),
          hasNonceStore: 'nonceStore' in this,
          modelKeys: Object.keys(this)
            .filter((k) => !k.startsWith('_') && !k.startsWith('$'))
            .slice(0, 30),
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        this.logger.log('[PrismaService] Prisma Client 诊断信息:', {
          prismaClientSource: this.constructor.name,
          hasNonceStore: 'nonceStore' in this,
          modelKeys: Object.keys(this)
            .filter((k) => !k.startsWith('_') && !k.startsWith('$'))
            .slice(0, 30),
          note: 'database 包路径解析失败（可能为 TypeScript 路径映射）',
        });
      }

      // Old P0 evidence replaced by P1-1 URL Audit
    }

    // P1-1 DB URL Source Audit
    const dbUrl = process.env.DATABASE_URL;
    const isProd = process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1';

    let source = 'DATABASE_URL';
    let activeUrl = dbUrl || 'unknown';

    if (!dbUrl) {
      source = 'missing';
      if (isProd) {
        const errMsg = `[P1-1] FATAL: DATABASE_URL is missing in production. Fail-fast triggered.`;
        console.error(errMsg);
        throw new Error(errMsg);
      }
    }

    try {
      if (activeUrl && activeUrl !== 'unknown') {
        const parsed = new URL(activeUrl);
        const host = parsed.hostname;
        const port = parsed.port || '5432';
        const db = parsed.pathname.substring(1);
        const auditMsg = `[DB_URL_AUDIT] source=${source} host=${host} port=${port} db=${db}`;
        // eslint-disable-next-line no-console
        console.log(auditMsg);
        this.logger.log(auditMsg);
      }
    } catch (e) {
      const auditMsg = `[DB_URL_AUDIT] source=${source} unparseable_url`;
      // eslint-disable-next-line no-console
      console.log(auditMsg);
      this.logger.log(auditMsg);
    }
  }

  private isCiOrGateContext(): boolean {
    return isCiOrGateContextEnv();
  }

  private shouldEnforceClientQueryTimeout(): boolean {
    return (
      this.isCiOrGateContext() ||
      process.env.PRISMA_ENFORCE_CLIENT_QUERY_TIMEOUT === '1'
    );
  }

  private async withTimeout<T>(
    run: () => Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        run(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async onModuleInit() {
    console.log('[DEBUG_BOOT] PrismaService.onModuleInit start ($connect)');
    try {
      await this.withTimeout(
        () => this.$connect(),
        this.connectTimeoutMs,
        `PRISMA_CONNECT_TIMEOUT: startup connect exceeded ${this.connectTimeoutMs}ms`
      );
      console.log('[DEBUG_BOOT] PrismaService.onModuleInit end ($connect)');
    } catch (e) {
      console.error('[DEBUG_BOOT] PrismaService.onModuleInit FAILED', e);
      this.logger.warn(`[PrismaService] Failed to connect to DB at startup: ${e}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
