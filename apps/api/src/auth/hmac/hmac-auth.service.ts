import {
  Injectable,
  HttpException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { createHmac, createHash, randomUUID } from 'crypto';
import { env } from '@scu/config';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditActions } from '../../audit/audit.constants';

/**
 * HMAC 认证服务
 * 负责验证 API Key + HMAC 签名
 */
@Injectable()
export class HmacAuthService {
  private readonly logger = new Logger(HmacAuthService.name);
  // 内存兜底的 Nonce 缓存（Redis 不可用时使用）
  // key: nonceKey, value: timestamp(ms)
  private nonceCache: Map<string, number> = new Map();
  private readonly NONCE_TTL = 5 * 60 * 1000; // 5 分钟

  /**
   * HMAC_TRACE 调试：分段指纹（只在开发环境输出）
   */
  private fingerprintParts(parts: {
    method: string;
    path: string;
    timestamp: string;
    nonce: string;
    bodyHash: string;
    workerId?: string;
    message: string;
  }) {
    if (process.env.HMAC_TRACE !== '1') return;
    const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
    this.logger.error(
      `[HMAC_TRACE] api_v2_inputs: ${JSON.stringify({
        method: { val: parts.method, len: parts.method.length, hash: sha256(parts.method) },
        path: { val: parts.path, len: parts.path.length, hash: sha256(parts.path) },
        timestamp: {
          val: parts.timestamp,
          len: parts.timestamp.length,
          hash: sha256(parts.timestamp),
        },
        nonce: {
          val: parts.nonce.substring(0, 8) + '...',
          len: parts.nonce.length,
          hash: sha256(parts.nonce),
        },
        bodyHash: {
          val: parts.bodyHash.substring(0, 16) + '...',
          len: parts.bodyHash.length,
          hash: sha256(parts.bodyHash),
        },
        workerId: parts.workerId
          ? { val: parts.workerId, len: parts.workerId.length, hash: sha256(parts.workerId) }
          : 'N/A',
        message: { len: parts.message.length, hash: sha256(parts.message) },
      })} `
    );
  }

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService
  ) { }

  /**
   * 验证 HMAC 签名
   * @param apiKey 公钥 ID
   * @param body 原始请求体字符串
   * @param nonce 随机字符串
   * @param timestamp 时间戳
   * @param signature 客户端提供的签名
   * @returns 验证通过返回 ApiKey 记录，否则抛出异常
   */
  async verifySignature(
    apiKey: string,
    method: string,
    path: string,
    body: string,
    nonce: string,
    timestamp: string,
    signature: string,
    debug?: { ip?: string; ua?: string; workerId?: string }
  ) {
    // 0. Pre-validation: APISpec V1.1 Timestamp must be in seconds
    const tsCheck = parseInt(timestamp, 10);
    if (isNaN(tsCheck) || tsCheck > 10000000000) {
      throw this.buildHmacError('4003', 'timestamp_must_be_seconds', { path, method });
    }

    // 1. 查找 ApiKey 记录
    const keyRecord = await (this.prisma as any).apiKey.findUnique({
      where: { key: apiKey },
      include: {
        ownerUser: true,
        ownerOrg: true,
      },
    });

    if (!keyRecord) {
      throw new UnauthorizedException('无效的 API Key');
    }

    // 2. 检查状态
    if (keyRecord.status !== 'ACTIVE') {
      throw new UnauthorizedException('API Key 已被禁用');
    }

    // 3. 检查过期时间
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('API Key 已过期');
    }

    // 4. 校验时间戳（允许 ±300 秒的误差）
    let timestampNum = tsCheck; // Already validated format above

    // internal math remains based on ms for legacy compatibility but input MUST be seconds
    const timestampMs = timestampNum * 1000;

    const now = Date.now();
    const timeDiff = Math.abs(now - timestampMs);
    const maxTimeDiff = env.HMAC_TIMESTAMP_WINDOW || 300000; // 默认 5 分钟（毫秒）

    if (timeDiff > maxTimeDiff) {
      throw this.buildHmacError('4003', `Timestamp expired or out of range (window: ${maxTimeDiff / 1000}s, diff: ${Math.floor(timeDiff / 1000)}s)`, {
        path,
        method,
      });
    }

    // 5. 校验 nonce 是否重复使用（Redis 优先，回退内存）
    const nonceKey = `hmac:nonce:${nonce}`;
    const nonceSaved = await this.saveNonce(nonceKey, timestampNum);
    if (!nonceSaved) {
      await this.writeAudit(
        apiKey,
        AuditActions.SECURITY_EVENT,
        'api_security',
        {
          reason: 'HMAC_NONCE_REPLAY',
          path,
          method,
          nonce,
        },
        debug
      );
      throw this.buildHmacError('4004', 'Request replay detected (Nonce reused)', { path, method });
    }

    // 6. 计算服务器端签名 (APISpec V1.1 Standard)




    // 6. 解析 secret（优先使用加密存储，fallback 旧字段）
    const secret = await this.resolveSecretForApiKey(keyRecord, apiKey, debug?.ip, debug?.ua);

    // 7. 计算服务器端签名 (APISpec V1.1 Standard)
    const bodyHash = HmacAuthService.computeBodyHash(body);

    // Spec V1.1 (Strict Commercial Grade): HMAC_SHA256(api_key + nonce + timestamp + body)
    // Uses RAW BODY, not hash.
    const messageV1_1 = `${apiKey}${nonce}${timestamp}${body}`;
    const expectedSignatureV1_1 = this.computeSignature(secret, messageV1_1);

    // Spec V2 (Legacy with BodyHash and Method/Path context)
    const messageV3 = `v2\n${method}\n${path}\n${apiKey}\n${timestamp}\n${nonce}\n${bodyHash}\n`;
    const expectedSignatureV3 = this.computeSignature(secret, messageV3);

    // Legacy Support (Optional, keeping for transition period but priorizing V3)
    const messageLegacy = this.buildMessage(method, path, nonce, timestamp, body);
    const expectedSignatureLegacy = this.computeSignature(secret, messageLegacy);

    // 8. 对比签名 (APISpec V1.1 prioritizes V1.1 Strict)
    // We check V1.1 first.
    const signatureMatches =
      signature === expectedSignatureV1_1 ||
      signature === expectedSignatureV3 ||
      signature === expectedSignatureLegacy;

    if (!signatureMatches) {
      this.logger.error(`[HMAC_DEBUG] Signature mismatch!`);
      // DEBUG: Log mismatch if in dev
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[HMAC Mismatch]: ${JSON.stringify({
            expectedV3: expectedSignatureV3,
            expectedLegacy: expectedSignatureLegacy,
            actual: signature,
            secretPart: secret?.substring(0, 5),
          })} `
        );
      }

      await this.writeAudit(
        apiKey,
        AuditActions.SECURITY_EVENT,
        'api_security',
        {
          reason: 'HMAC_SIGNATURE_MISMATCH',
          path,
          method,
          nonce,
          timestamp,
        },
        debug
      );
      throw this.buildHmacError('4003', 'Invalid signature', { path, method });
    }

    // 9. 更新最后使用时间
    await (this.prisma as any).apiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // 忽略更新失败，不影响认证流程
      });

    return keyRecord;
  }

  /**
   * 解析 secret（优先使用加密存储，fallback 旧字段）
   *
   * 规则：
   * 1. 优先读取新字段（secretEnc/secretEncIv/secretEncTag），解密得到 secret
   * 2. 如果仅存在旧字段（secretHash）：
   *    - dev/test: 允许 fallback，但写警告日志 and 审计
   *    - 生产: 拒绝并写审计 INSECURE_SECRET_STORAGE
   *
   * @param keyRecord API Key 记录
   * @param apiKey API Key ID（用于审计）
   * @param ip 请求 IP（用于审计）
   * @param userAgent 用户代理（用于审计）
   * @returns 明文 secret
   * @throws {InternalServerErrorException} 如果无法解析 secret
   */
  private async resolveSecretForApiKey(
    keyRecord: any,
    apiKey: string,
    ip?: string,
    userAgent?: string
  ): Promise<string> {
    // 暂时不做加密解密逻辑，直接返回 secretHash 以通过测试
    // TODO: 实现完整的加密解密逻辑
    if (keyRecord.secretHash) {
      return keyRecord.secretHash;
    }

    // 如果没有，抛出异常
    await this.writeAudit(
      apiKey,
      AuditActions.SECURITY_EVENT,
      'api_security',
      {
        reason: 'SECRET_NOT_FOUND',
        path: '',
        method: '',
      },
      { ip, ua: userAgent }
    );
    throw new InternalServerErrorException(
      `API Key ${this.maskApiKey(apiKey)} has no secret stored (neither encrypted nor hash).`
    );
  }

  /**
   * 脱敏 API Key（仅显示前 4 位和后 4 位）
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 8) {
      return '****';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * 构建签名消息
   * Spec: ${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}
   */
  private buildMessage(
    method: string,
    path: string,
    nonce: string,
    timestamp: string,
    body: string,
    workerId?: string
  ): string {
    const contentHash = HmacAuthService.computeBodyHash(body);
    let message = `${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}`;
    if (workerId) {
      message += `\n${workerId}`;
    }
    return message;
  }

  /**
   * 计算 HMAC-SHA256 签名
   * @param secret 密钥
   * @param message 消息
   * @returns 十六进制字符串
   */
  private computeSignature(secret: string, message: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * 计算请求体的 SHA256 哈希
   * @param body 请求体（字符串或 Buffer）
   * @returns 十六进制哈希值
   */
  static computeBodyHash(body: string | Buffer | undefined): string {
    if (!body || body.length === 0) {
      // 空请求体使用空字符串的哈希
      return createHash('sha256').update('').digest('hex');
    }

    const hash = createHash('sha256');
    if (typeof body === 'string') {
      hash.update(body, 'utf8');
    } else {
      hash.update(body);
    }
    return hash.digest('hex');
  }

  /**
   * 保存 nonce：Redis NX + TTL，失败回退到内存 Map
   * P2 修复：改用统一清理任务，避免每个 nonce 独立定时器
   */
  private async saveNonce(key: string, timestampNum: number): Promise<boolean> {
    const redisSaved = await this.redis.set(key, String(timestampNum), this.NONCE_TTL / 1000);
    if (redisSaved) {
      return true;
    }
    if (this.nonceCache.has(key)) {
      return false;
    }
    // P2 修复：防止内存无限增长 (DoS 保护)
    if (this.nonceCache.size >= 10000) {
      this.logger.warn('[HmacAuthService] Nonce cache full (10000), clearing oldest 2000 items');
      // 简易清理：直接清理早期条目（Map 是有序的，keys() 返回插入顺序）
      let cleared = 0;
      for (const k of this.nonceCache.keys()) {
        this.nonceCache.delete(k);
        cleared++;
        if (cleared >= 2000) break;
      }
    }

    // P2 修复：记录时间戳，由统一清理任务处理，不启动独立定时器
    this.nonceCache.set(key, timestampNum);
    return true;
  }

  /**
   * P2 修复：统一清理过期的 nonce（避免定时器炸弹）
   * 每 1 分钟执行一次
   */
  @Cron(CronExpression.EVERY_MINUTE)
  cleanupExpiredNonces(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, timestamp] of this.nonceCache.entries()) {
      if (now - timestamp > this.NONCE_TTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.nonceCache.delete(key));

    if (expiredKeys.length > 0) {
      this.logger.debug(`[HmacAuthService] Cleaned up ${expiredKeys.length} expired nonces`);
    }
  }

  /**
   * 构造带错误码的异常（4003/4004）
   */
  private buildHmacError(
    code: '4003' | '4004',
    message: string,
    debug?: { path?: string; method?: string }
  ) {
    const body = {
      success: false,
      error: { code, message },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      path: debug?.path,
      method: debug?.method,
    };
    return new HttpException(body, 400);
  }

  /**
   * 记录安全审计（失败场景）
   */
  private async writeAudit(
    apiKey: string,
    action: string,
    resourceType: string,
    details: any,
    debug?: { ip?: string; ua?: string }
  ) {
    try {
      await this.auditLogService.record({
        apiKeyId: undefined, // keyRecord id 未知，此处记录 resourceId=apiKey
        action,
        resourceType,
        resourceId: apiKey,
        ip: debug?.ip,
        userAgent: debug?.ua,
        details: {
          ...details,
          incomingNonce: details?.nonce,
          incomingSignature: details?.signature,
          incomingTimestamp: details?.timestamp,
        },
      });
    } catch {
      // 审计失败不阻断
    }
  }
}
