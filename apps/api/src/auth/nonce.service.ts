import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditActions } from '../audit/audit.constants';
import { buildHmacError } from '../common/utils/hmac-error.utils';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

/**
 * NonceService
 * 参考《AI开发文档规则》《平台安全体系》：用于防重放
 */
@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);
  private readonly nonceTtlSeconds = Number(process.env.NONCE_TTL_SECONDS || '300');
  // Dev-only: 内存 Map 作为 fallback（仅当 Redis 不可用时）
  private readonly devMemoryStore = new Map<string, { timestamp: number; expiresAt: number }>();
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(RedisService)
    private readonly redisService?: RedisService
  ) {}

  /**
   * 检查并写入 nonce，若已存在则抛出异常
   * @param nonce Nonce 值
   * @param apiKey API Key
   * @param timestamp 时间戳（秒）
   * @param requestInfo 请求信息（用于审计）
   */
  async assertAndStoreNonce(
    nonce: string,
    apiKey: string,
    timestamp: number,
    requestInfo?: { path?: string; method?: string; ip?: string; ua?: string }
  ) {
    // P0: 强制参数校验
    if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
      throw buildHmacError('4003', 'Invalid timestamp provided', {
        path: requestInfo?.path,
        method: requestInfo?.method,
      });
    }
    // 开发/测试环境：记录写入前信息
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `准备写入 nonce: ${JSON.stringify({
          apiKey: apiKey.substring(0, 8) + '...',
          nonce: nonce.substring(0, 16) + '...',
          timestamp,
          path: requestInfo?.path,
          method: requestInfo?.method,
        })}`
      );
    }

    const nonceKey = `nonce:${apiKey}:${nonce}`;

    try {
      if (this.isDev) {
        const now = Date.now();
        const existing = this.devMemoryStore.get(nonceKey);
        if (existing && existing.expiresAt > now) {
          throw {
            code: 'P2002',
            message: 'Unique constraint failed',
            meta: { target: ['nonce', 'apiKey'] },
          };
        }
        this.devMemoryStore.set(nonceKey, {
          timestamp,
          expiresAt: now + this.nonceTtlSeconds * 1000,
        });

        if (process.env.NODE_ENV !== 'production') {
          this.logger.log(
            `✅ nonce stored ok (使用 devMemoryStore): ${JSON.stringify({
              nonce: nonce.substring(0, 16) + '...',
              apiKey: apiKey.substring(0, 8) + '...',
            })}`
          );
        }
        return;
      }

      if (this.redisService) {
        const stored = await this.redisService.setNx(nonceKey, String(timestamp), this.nonceTtlSeconds);
        if (stored) {
          return;
        }

        const existing = await this.redisService.get(nonceKey);
        if (existing !== null) {
          throw {
            code: 'P2002',
            message: 'Unique constraint failed',
            meta: { target: ['nonce', 'apiKey'] },
          };
        }
      }

      await this.prisma.nonceStore.create({
        data: {
          nonce,
          apiKey,
          timestamp: BigInt(timestamp),
        },
      });

      // 开发/测试环境：确认写入成功
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `✅ nonce stored ok (使用 prisma.nonceStore): ${JSON.stringify({
            nonce: nonce.substring(0, 16) + '...',
            apiKey: apiKey.substring(0, 8) + '...',
          })}`
        );
      }
    } catch (err: any) {
      // 开发/测试环境：记录错误详情
      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          `nonce 写入失败: ${JSON.stringify({
            error: err.message,
            code: err.code,
            meta: err.meta,
            nonce: nonce.substring(0, 16) + '...',
            apiKey: apiKey.substring(0, 8) + '...',
          })}`
        );
      }

      // 唯一索引冲突视为重放（P2002: Unique constraint failed）
      // 其他错误（如连接失败、表不存在等）也应该记录并抛出
      const isUniqueConstraintError = err.code === 'P2002';

      if (isUniqueConstraintError) {
        // 唯一索引冲突：这是重放攻击
        // P0 必须：写入审计日志
        const traceId = randomUUID();
        await this.auditService
          .log({
            action: AuditActions.SECURITY_EVENT,
            resourceType: 'api_key',
            resourceId: apiKey,
            traceId,
            ip: requestInfo?.ip || null,
            userAgent: requestInfo?.ua || null,
            details: {
              reason: 'NONCE_REPLAY_DETECTED',
              nonce,
              timestamp,
              path: requestInfo?.path,
              method: requestInfo?.method,
            },
          })
          .catch(() => {
            // 审计失败不阻断
          });

        throw buildHmacError('4004', 'Nonce replay detected', {
          path: requestInfo?.path,
          method: requestInfo?.method,
        });
      } else {
        // 其他错误（如数据库连接失败、表不存在等）
        // 开发/测试环境：记录详细错误（结构化信息）
        if (process.env.NODE_ENV !== 'production') {
          this.logger.error(
            `非唯一约束错误 - 详细诊断信息: ${JSON.stringify({
              errorName: err?.name,
              errorMessage: err?.message,
              errorCode: err?.code,
              errorMeta: err?.meta,
              isPrismaClientKnownRequestError:
                err?.constructor?.name === 'PrismaClientKnownRequestError' ||
                err?.name === 'PrismaClientKnownRequestError',
              prismaServiceConstructor: this.prisma?.constructor?.name,
              prismaServiceKeys: Object.keys(this.prisma || {}).slice(0, 50),
              databaseUrl: this.getDatabaseUrlSafe(),
            })}`
          );
        }
        // 对于非重放错误，抛出通用错误（不应返回 4004）
        throw buildHmacError('4003', 'Nonce storage failed', {
          path: requestInfo?.path,
          method: requestInfo?.method,
        });
      }
    }
  }

  /**
   * 安全地获取数据库 URL（只显示 host/dbname，不显示密码）
   */
  private getDatabaseUrlSafe(): string {
    try {
      const url = process.env.DATABASE_URL || '';
      if (!url) return 'DATABASE_URL_NOT_SET';
      // 解析 URL，只显示安全部分
      try {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || '5432'}/${urlObj.pathname.split('/').pop() || ''}`;
      } catch {
        // 如果 URL 解析失败，只显示前 50 个字符（隐藏密码部分）
        return url.substring(0, 50) + '...';
      }
    } catch {
      return 'DATABASE_URL_PARSE_ERROR';
    }
  }
}
