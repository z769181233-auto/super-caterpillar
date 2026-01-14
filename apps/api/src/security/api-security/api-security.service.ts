import {
  Injectable,
  HttpException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditActions } from '../../audit/audit.constants';
import { Prisma } from 'database';
import { SecretEncryptionService } from './secret-encryption.service';
import { buildHmacError } from '../../common/utils/hmac-error.utils';
import {
  SignatureVerificationResult,
  SignatureVerificationContext,
  SignatureAuditDetails,
} from './api-security.types';

/**
 * API Security Service
 *
 * 负责 HMAC 签名验证、时间戳校验、Nonce 防重放
 *
 * 参考文档：
 * - 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》
 */
@Injectable()
export class ApiSecurityService {
  private readonly TIMESTAMP_WINDOW_SECONDS = 300; // ±5 分钟
  private readonly NONCE_TTL_SECONDS = 300; // 5 分钟
  private readonly logger = new Logger(ApiSecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLogService: AuditLogService,
    private readonly secretEncryptionService: SecretEncryptionService
  ) { }

  /**
   * 验证 HMAC 签名（v2 规范）
   *
   * 流程：
   * 1. 验证 API Key 存在且有效
   * 2. 验证时间戳在允许窗口内（±5 分钟）
   * 3. 验证 Nonce 未重复使用（Redis TTL 5 分钟）
   * 4. 计算并对比签名（v2 canonical string）
   * 5. 写入审计日志（成功/失败）
   */
  async verifySignature(
    context: SignatureVerificationContext
  ): Promise<SignatureVerificationResult> {
    const { apiKey, nonce, timestamp, signature, method, path, contentSha256, ip, userAgent } =
      context;

    try {
      // 0. Pre-validation: APISpec V1.1 Timestamp must be in seconds [Strict Regex]
      if (!/^\d{10}$/.test(timestamp)) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'TIMESTAMP_FORMAT_ERROR',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: 'timestamp_must_be_seconds',
        };
      }
      const timestampNum = parseInt(timestamp, 10);

      // 1. 查找 API Key 记录
      const keyRecord = await this.prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: {
          ownerUser: true,
          ownerOrg: true,
        },
      });

      if (!keyRecord) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'INVALID_API_KEY',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: '无效的 API Key',
        };
      }

      // 2. 检查状态
      if (keyRecord.status !== 'ACTIVE') {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'API_KEY_DISABLED',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: 'API Key 已被禁用',
        };
      }

      // 3. 检查过期时间
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'API_KEY_EXPIRED',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: 'API Key 已过期',
        };
      }

      // 4. 验证时间戳（允许 ±300 秒）


      const nowSec = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(nowSec - timestampNum);

      if (timeDiff > this.TIMESTAMP_WINDOW_SECONDS) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'TIMESTAMP_OUT_OF_WINDOW',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: `时间戳超出允许范围（±${this.TIMESTAMP_WINDOW_SECONDS}秒）`,
        };
      }

      // 5. 验证 Nonce 防重放（Redis TTL 5 分钟）
      const nonceKey = `api_security:nonce:${apiKey}:${nonce}`;
      const nonceExists = await this.redis.get(nonceKey);
      if (nonceExists) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'NONCE_REPLAY',
            errorCode: '4004',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4004',
          errorMessage: 'Nonce 已被使用，请重新生成请求',
        };
      }

      // 保存 Nonce（TTL 5 分钟）
      await this.redis.set(nonceKey, timestamp, this.NONCE_TTL_SECONDS);

      // 6. 解析 secret（优先使用加密存储，fallback 旧字段）
      const secret = await this.resolveSecretForApiKey(keyRecord, apiKey, ip, userAgent);

      // 7. 计算服务器端签名（v2 规范）
      // 使用原始 path，但在 canonical string 中进行规范化
      const canonicalString = this.buildCanonicalStringV2(
        method,
        path,
        apiKey,
        timestamp,
        nonce,
        (context.body === '{}') ? '' : (context.body || '') // Fix: Normalize '{}' to empty string for GET requests
      );
      this.logger.warn(`[HMAC_DEBUG] Canonical String: [${canonicalString}]`);
      const expectedSignature = this.computeSignature(secret, canonicalString);

      // 8. 对比签名 (Counter Timing Attack)
      // 8. 对比签名 (Counter Timing Attack) - Hex Buffer hardening
      // signature / expectedSignature are hex strings (sha256 HMAC hex)
      const isHex = (s: string) => typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;

      // Fast reject invalid hex to avoid Buffer.from throwing and to keep behavior deterministic
      if (!isHex(signature) || !isHex(expectedSignature)) {
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'SIGNATURE_FORMAT_ERROR',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: 'invalid_signature',
        };
      }

      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

      // timingSafeEqual requires same length; SHA256 HMAC should be 32 bytes
      const valid =
        signatureBuffer.length === expectedSignatureBuffer.length &&
        signatureBuffer.length === 32 &&
        timingSafeEqual(signatureBuffer, expectedSignatureBuffer);

      if (!valid) {
        this.logger.error(
          `[HMAC_DEBUG] Signature Mismatch! Method: ${method}, Path: ${path}, apiKey: ${this.maskApiKey(apiKey)}`
        );
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'SIGNATURE_MISMATCH',
            errorCode: '4003',
          },
          ip,
          userAgent
        );
        return {
          success: false,
          errorCode: '4003',
          errorMessage: 'invalid_signature',
        };
      }

      // 9. 更新最后使用时间
      await this.prisma.apiKey
        .update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {
          // 忽略更新失败，不影响认证流程
        });

      // 10. 写入成功审计日志
      await this.writeAuditLog(
        {
          nonce,
          signature,
          timestamp,
          path,
          method,
          apiKey: this.maskApiKey(apiKey),
          reason: 'SIGNATURE_VERIFIED',
        },
        ip,
        userAgent,
        keyRecord.id
      );

      return {
        success: true,
        apiKeyId: keyRecord.id,
        apiKey: apiKey,
      };
    } catch (error: unknown) {
      const err = error as Error;
      // 记录异常审计
      await this.writeAuditLog(
        {
          nonce,
          signature,
          timestamp,
          path,
          method,
          apiKey: this.maskApiKey(apiKey),
          reason: 'VERIFICATION_ERROR',
          errorCode: '500',
        },
        ip,
        userAgent
      );

      return {
        success: false,
        errorCode: '500',
        errorMessage: err?.message || '签名验证异常',
      };
    }
  }

  /**
   * 构建规范字符串 v2（Canonical String v2）
   *
   * 格式：
   * v2\n
   * {METHOD}\n
   * {PATH_WITH_QUERY}\n
   * {API_KEY}\n
   * {TIMESTAMP}\n
   * {NONCE}\n
   * {CONTENT_SHA256}\n
   *
   * 规则：
   * - 第一行固定为 "v2"
   * - 每行用 \n 分隔（严格换行符）
   * - PATH_WITH_QUERY: 包含 query string（从 req.url 获取）
   * - CONTENT_SHA256: JSON 请求为 sha256(rawBodyBytes)，multipart 为 "UNSIGNED"
   */
  /**
   * 构建规范字符串 v2 (Strict APISpec V1.1)
   *
   * 格式：
   * {API_KEY}{NONCE}{TIMESTAMP}{BODY}
   *
   * 规则：
   * - 严格遵循 APISpec V1.1 文本定义
   * - 移除 method/path 依赖，防止网关/代理导致的路径不一致问题
   * - Body 为原始 JSON string 或 "UNSIGNED" (multipart)
   */
  buildCanonicalStringV2(
    method: string,
    pathWithQuery: string,
    apiKey: string,
    timestamp: string,
    nonce: string,
    body: string
  ): string {
    // APISpec V1.1: X-Signature = HMAC_SHA256(api_key + nonce + timestamp + rawBody)
    const result = `${apiKey}${nonce}${timestamp}${body}`;
    return result;
  }

  /**
   * 计算 SHA256 哈希（十六进制）
   *
   * @param data 原始数据（Buffer 或 string）
   * @returns 十六进制哈希值
   */
  sha256Hex(data: Buffer | string): string {
    const hash = createHash('sha256');
    if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(data, 'utf8');
    }
    return hash.digest('hex');
  }

  /**
   * 构建规范字符串 v1（已废弃，保留用于兼容）
   *
   * @deprecated 使用 buildCanonicalStringV2 代替
   */
  buildCanonicalString(apiKey: string, nonce: string, timestamp: string, body: string): string {
    const normalizedBody = body || '';
    return `${apiKey}${nonce}${timestamp}${normalizedBody}`;
  }

  /**
   * 计算 HMAC-SHA256 签名
   */
  computeSignature(secret: string, message: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(message, 'utf8');
    return hmac.digest('hex');
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
    keyRecord: Prisma.ApiKeyGetPayload<any>,
    apiKey: string,
    ip?: string,
    userAgent?: string
  ): Promise<string> {
    // 1. 优先使用新字段（加密存储）
    if (keyRecord.secretEnc && keyRecord.secretEncIv && keyRecord.secretEncTag) {
      // 只有在配置了主密钥时才尝试解密
      if (this.secretEncryptionService.isMasterKeyConfigured()) {
        try {
          const secret = this.secretEncryptionService.decryptSecret(
            keyRecord.secretEnc,
            keyRecord.secretEncIv,
            keyRecord.secretEncTag
          );
          return secret;
        } catch (error: unknown) {
          const err = error as Error;
          // 解密失败，记录错误但如果环境允许 fallback 则继续（防炸保护）
          this.logger.error(
            `Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}: ${err.message}`
          );
        }
      }
    }

    // 2. Fallback 到旧字段（仅 dev/test 允许，或主密钥未配置时）
    if (keyRecord.secretHash) {
      const isProduction = process.env.NODE_ENV === 'production';
      const isMasterKeyConfigured = this.secretEncryptionService.isMasterKeyConfigured();

      // 只有在生产环境且主密钥已配置的情况下才强制拦截（硬门禁）
      if (isProduction && isMasterKeyConfigured) {
        await this.writeAuditLog(
          {
            nonce: '',
            signature: '',
            timestamp: new Date().toISOString(),
            path: '',
            method: '',
            apiKey: this.maskApiKey(apiKey),
            reason: 'INSECURE_SECRET_STORAGE',
            errorCode: '500',
          },
          ip,
          userAgent,
          keyRecord.id
        );

        throw new InternalServerErrorException(
          `API Key ${this.maskApiKey(apiKey)} uses insecure secret storage (secretHash). ` +
          `Production environment requires encrypted storage.`
        );
      } else {
        // dev/test 环境或主密钥未配置：允许 fallback
        this.logger.warn(
          `API Key ${this.maskApiKey(apiKey)} using secretHash fallback (isMasterKeyConfigured=${isMasterKeyConfigured})`
        );
        return keyRecord.secretHash;
      }
    }

    // 3. 既没有新字段也没有旧字段：错误
    await this.writeAuditLog(
      {
        nonce: '',
        signature: '',
        timestamp: new Date().toISOString(),
        path: '',
        method: '',
        apiKey: this.maskApiKey(apiKey),
        reason: 'SECRET_NOT_FOUND',
        errorCode: '500',
      },
      ip,
      userAgent,
      keyRecord.id
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
   * 写入审计日志
   */
  private async writeAuditLog(
    details: SignatureAuditDetails,
    ip?: string,
    userAgent?: string,
    apiKeyId?: string
  ): Promise<void> {
    try {
      await this.auditLogService.record({
        apiKeyId,
        action: AuditActions.SECURITY_EVENT,
        resourceType: 'api_security',
        resourceId: details.apiKey || undefined,
        ip,
        userAgent,
        // Mandated by DBSpec V1.1 columns
        nonce: details.nonce,
        signature: details.signature,
        // Fix: Only write valid timestamps to DB, otherwise use incomingTimestamp in details
        timestamp: /^\d{10}$/.test(details.timestamp)
          ? new Date(parseInt(details.timestamp, 10) * 1000)
          : undefined,
        details: {
          reason: details.reason,
          path: details.path,
          method: details.method,
          errorCode: details.errorCode,
          incomingNonce: details.nonce,
          incomingSignature: details.signature,
          incomingTimestamp: details.timestamp,
        },
      });
    } catch (error: unknown) {
      // 审计失败不阻断主流程，且安全地记录错误原因（截断防刷屏）
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write audit log (non-blocking): ${errMessage.slice(0, 300)}`);
    }
  }
}
