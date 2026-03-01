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

      // P0 风险整治证据：打印最终生效的 DATABASE_URL
      const dbUrl = process.env.DATABASE_URL || 'unknown';
      const masked = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
      // eslint-disable-next-line no-console
      this.logger.log(`[P0_EVIDENCE] Active DATABASE_URL: ${masked}`);
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (e) {
      this.logger.warn(`[PrismaService] Failed to connect to DB at startup (likely due to MOCK_DATABASE_URL on Railway): ${e}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
