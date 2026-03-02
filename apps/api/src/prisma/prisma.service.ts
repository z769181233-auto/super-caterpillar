import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from 'database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
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
    const mockUrl = process.env.MOCK_DATABASE_URL;
    const isProd = process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1';

    let source = 'fallback/missing';
    let activeUrl = 'unknown';

    if (dbUrl) {
      source = 'DATABASE_URL';
      activeUrl = dbUrl;
    } else if (mockUrl) {
      source = 'MOCK_DATABASE_URL';
      activeUrl = mockUrl;
    }

    if (isProd && source !== 'DATABASE_URL') {
      const errMsg = `[P1-1] FATAL: DATABASE_URL is missing or using fallback/mock in production. Fail-fast triggered.`;
      // eslint-disable-next-line no-console
      console.error(errMsg);
      throw new Error(errMsg);
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
    try {
      await this.$connect();
    } catch (e) {
      this.logger.warn(`[PrismaService] Failed to connect to DB at startup: ${e}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
