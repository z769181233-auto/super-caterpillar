import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from 'database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectTimeoutMs = Number(process.env.PRISMA_CONNECT_TIMEOUT_MS || '5000');
  private readonly queryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  constructor() {
    super({});
    this.$use(async (params, next) => {
      return await Promise.race([
        next(params),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `PRISMA_QUERY_TIMEOUT: ${params.model || '$raw'}.${params.action} exceeded ${this.queryTimeoutMs}ms`
                )
              ),
            this.queryTimeoutMs
          )
        ),
      ]);
    });
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

  async onModuleInit() {
    console.log('[DEBUG_BOOT] PrismaService.onModuleInit start ($connect)');
    try {
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `PRISMA_CONNECT_TIMEOUT: startup connect exceeded ${this.connectTimeoutMs}ms`
                )
              ),
            this.connectTimeoutMs
          )
        ),
      ]);
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
