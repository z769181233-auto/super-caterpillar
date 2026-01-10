import {
  Injectable,
  HttpException,
  UnauthorizedException,
  BadRequestException,
  Logger,
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
    this.logger.error(`[HMAC_TRACE] api_v2_inputs: ${JSON.stringify({
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
    })}`);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
    let timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      throw this.buildHmacError('4003', '时间戳格式错误', { path, method });
    }

    // 支持秒/毫秒
    if (timestampNum < 1_000_000_000_000) {
      timestampNum *= 1000;
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - timestampNum);
    const maxTimeDiff = env.HMAC_TIMESTAMP_WINDOW || 300000; // 默认 5 分钟（毫秒）

    if (timeDiff > maxTimeDiff) {
      throw this.buildHmacError('4003', `时间戳超出允许范围（±${maxTimeDiff / 1000}秒）`, {
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
      throw this.buildHmacError('4004', 'Nonce 已被使用，请重新生成请求', { path, method });
    }

    // 6. 计算服务器端签名
    // 注意：对于最小可用版，secretHash 字段直接存储 secret（生产环境应使用加密存储）
    const secret = keyRecord.secretHash; // 临时方案：假设 secretHash 就是 secret（实际应解密）

    const messageV1 = this.buildMessage(method, path, nonce, timestamp, body);
    const expectedSignatureV1 = this.computeSignature(secret, messageV1);

    const bodyHash = HmacAuthService.computeBodyHash(body);
    const messageV2Old = `v2\n${method}\n${path}\n${apiKey}\n${timestamp}\n${nonce}\n${bodyHash}\n`;
    const expectedSignatureV2Old = this.computeSignature(secret, messageV2Old);

    // v2-with-workerId: 新增支持，从request取x-worker-id
    const workerId = (debug as any)?.workerId;
    let expectedSignatureV2WithWorkerId: string | null = null;
    let messageV2WithWorkerId: string | null = null;
    if (workerId) {
      messageV2WithWorkerId = this.buildMessage(method, path, nonce, timestamp, body, workerId);
      expectedSignatureV2WithWorkerId = this.computeSignature(secret, messageV2WithWorkerId);

      // HMAC_TRACE: 输出API端v2分段指纹
      this.fingerprintParts({
        method,
        path,
        timestamp,
        nonce,
        bodyHash,
        workerId,
        message: messageV2WithWorkerId,
      });
      if (process.env.HMAC_TRACE === '1') {
        this.logger.error(`[HMAC_TRACE] api_v2_expected: ${JSON.stringify({
          expectedSigHash: createHash('sha256')
            .update(expectedSignatureV2WithWorkerId)
            .digest('hex'),
          expectedSigLen: expectedSignatureV2WithWorkerId.length,
        })}`);
      }
    }

    // 7. 对比签名 (支持 v1 / v2-old / v2-with-workerId)
    const signatureMatches =
      signature === expectedSignatureV1 ||
      signature === expectedSignatureV2Old ||
      (expectedSignatureV2WithWorkerId && signature === expectedSignatureV2WithWorkerId);

    if (!signatureMatches) {
      // DEBUG: Log mismatch if in dev
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[HMAC Mismatch]: ${JSON.stringify({
          expectedV1: expectedSignatureV1,
          expectedV2Old: expectedSignatureV2Old,
          expectedV2WorkerId: expectedSignatureV2WithWorkerId,
          actual: signature,
          workerId,
          secretPart: secret?.substring(0, 5),
        })}`);
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
      throw this.buildHmacError('4003', '签名验证失败', { path, method });
    }

    // 8. 更新最后使用时间
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
