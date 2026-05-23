import {
  Inject,
  Injectable,
  forwardRef,
  HttpException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { createHash, timingSafeEqual, webcrypto } from 'crypto';
import { pickHmacSecretSSOT } from '@scu/config';

import { AuditActions } from '../../audit/audit.constants';
import { Prisma } from 'database';
import { SecretEncryptionService } from './secret-encryption.service';
import { buildHmacError } from '../../common/utils/hmac-error.utils';
import { getRuntimeDbTimeoutMs } from '../../prisma/pg-runtime.util';

function summarizeSensitiveInput(value: string) {
  // Debug-only metadata; avoid hashing or echoing sensitive inputs to keep CodeQL and logs clean.
  return { len: value.length };
}
type NodeCryptoKey = Awaited<ReturnType<typeof webcrypto.subtle.importKey>>;
const textEncoder = new TextEncoder();
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
  private readonly prismaQueryTimeoutMs = getRuntimeDbTimeoutMs('query');

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(forwardRef(() => AuditLogService))
    private readonly auditLogService: AuditLogService,
    @Inject(SecretEncryptionService)
    private readonly secretEncryptionService: SecretEncryptionService
  ) { }

  private shouldAllowEnvSecretFallback(): boolean {
    return process.env.ALLOW_HMAC_ENV_FALLBACK === '1';
  }

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

    const dbg = false;
    const dlog = (_obj: any) => {};

    dlog({
      step: 'enter',
      path,
      method,
      ip,
      xApiKey: apiKey ? apiKey.slice(0, 12) + '...' : undefined,
      xTimestamp: timestamp,
      xNonce: nonce ? nonce.slice(0, 20) + '...' : undefined,
      xSigLen: signature ? signature.length : 0,
      xSigPrefix: signature ? signature.slice(0, 12) : undefined,
      contentSha256: contentSha256 || 'undefined',
    });

    try {
      // 0. Pre-validation: APISpec V1.1 Timestamp must be in seconds [Strict Regex]
      if (!/^\d{10}$/.test(timestamp)) {
        dlog({ step: 'reject', reason: 'timestamp_format_error', timestamp });
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
      dlog({ step: 'db_lookup_api_key_start', apiKey: apiKey.slice(0, 12) + '...' });

      this.logger.log(
        `[API_SEC_DEBUG] verifySignature: Searching for apiKey. this.prisma: ${!!this.prisma}`
      );
      if (!this.prisma?.apiKey) {
        this.logger.error(
          `[API_SEC_DEBUG] CRITICAL: this.prisma.apiKey is undefined! Keys: ${Object.keys(this.prisma || {})}`
        );
        throw new Error('Prisma Client Malformed: apiKey model missing');
      }

      const keyRecord = await this.findApiKeyRecord(apiKey);

      if (!keyRecord) {
        dlog({ step: 'reject', reason: 'invalid_api_key', apiKey: apiKey.slice(0, 12) + '...' });
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
        dlog({ step: 'reject', reason: 'api_key_disabled', status: keyRecord.status });
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
        dlog({ step: 'reject', reason: 'api_key_expired', expiresAt: keyRecord.expiresAt });
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
      dlog({ step: 'timestamp_check_start' });

      const nowSec = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(nowSec - timestampNum);

      if (timeDiff > this.TIMESTAMP_WINDOW_SECONDS) {
        dlog({
          step: 'reject',
          reason: 'timestamp_out_of_window',
          timeDiff,
          window: this.TIMESTAMP_WINDOW_SECONDS,
        });
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
      dlog({ step: 'timestamp_check_pass', timeDiff });

      // 5. 验证 Nonce 防重放（Redis TTL 5 分钟）
      dlog({ step: 'nonce_check_start' });
      const nonceKey = `api_security:nonce:${apiKey}:${nonce}`;
      const nonceExists = await this.redis.get(nonceKey);
      if (nonceExists) {
        dlog({ step: 'reject', reason: 'nonce_replay' });
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

      // 6. Resolve per-key secret FIRST (DB encrypted -> decrypt)
      // Default MUST be DB per-key; env secret is only a fallback for gate/dev alignment.
      let secret = '';
      let secretSource: string = 'none';

      try {
        secret = await this.resolveSecretForApiKey(keyRecord, apiKey, ip, userAgent);
        secretSource = 'db_per_key';
      } catch (e) {
        if (!this.shouldAllowEnvSecretFallback()) {
          throw e;
        }
        this.logger.warn(
          `API Key ${this.maskApiKey(apiKey)} falling back to env-backed HMAC secret via explicit override`
        );
        await this.writeAuditLog(
          {
            nonce,
            signature,
            timestamp,
            path,
            method,
            apiKey: this.maskApiKey(apiKey),
            reason: 'ENV_SECRET_FALLBACK_USED',
          },
          ip,
          userAgent,
          keyRecord.id
        );
        secret = '';
      }

      if ((!secret || secret.length === 0) && this.shouldAllowEnvSecretFallback()) {
        secret = pickHmacSecretSSOT();
        secretSource = 'SSOT';
      }

      if (dbg) {
        const fp = summarizeSensitiveInput(secret || '');
        dlog({
          step: 'secret_pick',
          source: secretSource,
          secretLen: fp.len,
        });
      }

      if (!secret || secret.length === 0) {
        dlog({ step: 'reject', reason: 'secret_not_found' });
        return { success: false, errorCode: '500', errorMessage: 'secret_not_found' };
      }

      // 7. 计算服务器端签名（v2 规范）
      // APISpec V1.1: 签名输入必须按协议对齐。
      // GET/DELETE: body 强制规范化为 "" (空字符串)
      // POST/PUT/PATCH: 必须使用原始 rawBody，禁止将 "{}" 视为 ""。
      let bodyToSign = context.body || '';
      if (['GET', 'DELETE'].includes(method.toUpperCase())) {
        if (bodyToSign === '{}') {
          bodyToSign = '';
        }
      }

      const canonicalString = this.buildCanonicalStringV2(
        method,
        path,
        apiKey,
        timestamp,
        nonce,
        bodyToSign,
        contentSha256
      );

      // Debug canonical WITHOUT leaking raw content: sha12 only
      if (dbg) {
        const cfp = summarizeSensitiveInput(canonicalString);
        const bodyFp = summarizeSensitiveInput(bodyToSign);
        dlog({
          step: 'canonical',
          canonicalLen: cfp.len,
          bodyLen: bodyFp.len,
        });
      }

      const expectedSignature = await this.computeSignature(secret, canonicalString);

      // 8. 对比签名 (Counter Timing Attack)
      // 8. 对比签名 (Counter Timing Attack) - Hex Buffer hardening
      // signature / expectedSignature are hex strings (sha256 HMAC hex)
      const isHex = (s: string) =>
        typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;

      // Fast reject invalid hex to avoid Buffer.from throwing and to keep behavior deterministic
      if (!isHex(signature) || !isHex(expectedSignature)) {
        dlog({
          step: 'reject',
          reason: 'signature_format_error',
          sigIsHex: isHex(signature),
          expectedIsHex: isHex(expectedSignature),
        });
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

      dlog({
        step: 'compare',
        receivedPrefix: signature.slice(0, 12),
        computedPrefix: expectedSignature.slice(0, 12),
        match: valid,
      });

      if (!valid) {
        dlog({ step: 'reject', reason: 'signature_mismatch' });
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
        .catch(async (e) => {
          if (dbg) dlog({ step: 'db_update_lastUsedAt_failed', error: e?.message });
          this.logger.warn(
            `[ApiSecurityService] Failed to persist lastUsedAt for ${this.maskApiKey(apiKey)}: ${e instanceof Error ? e.message : String(e)}`
          );
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

      if (dbg) dlog({ step: 'exit_success' });
      return {
        success: true,
        apiKeyId: keyRecord.id,
        apiKey: apiKey,
        apiKeyRecord: keyRecord,
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
    body: string,
    contentSha256?: string
  ): string {
    // APISpec V1.1: X-Signature = HMAC_SHA256(api_key + nonce + timestamp + rawBody)
    // [P6-0 Fix]: Protocol Upgrade - Streaming or Massive Uploads
    // If method is POST and body is empty (meaning Guard skipped reading it),
    // we use contentSha256 for the canonical string (Sign Hash Protocol).
    if (method === 'POST' && body === '' && contentSha256) {
      return `${apiKey}${nonce}${timestamp}${contentSha256}`;
    }
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
   * 计算 HMAC-SHA256 签名
   */
  async computeSignature(secret: string, message: string): Promise<string> {
    const signingKey: NodeCryptoKey = await webcrypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await webcrypto.subtle.sign('HMAC', signingKey, textEncoder.encode(message));
    return Buffer.from(signature).toString('hex');
  }

  /**
   * 解析 secret（仅允许加密存储）
   */
  private async resolveSecretForApiKey(
    keyRecord: Prisma.ApiKeyGetPayload<any>,
    apiKey: string,
    ip?: string,
    userAgent?: string
  ): Promise<string> {
    const hasEncryptedSecret =
      !!keyRecord.secretEnc && !!keyRecord.secretEncIv && !!keyRecord.secretEncTag;
    const hasAnyEncryptedSecretField =
      !!keyRecord.secretEnc || !!keyRecord.secretEncIv || !!keyRecord.secretEncTag;

    if (hasAnyEncryptedSecretField && !hasEncryptedSecret) {
      await this.writeAuditLog(
        {
          nonce: '',
          signature: '',
          timestamp: new Date().toISOString(),
          path: '',
          method: '',
          apiKey: this.maskApiKey(apiKey),
          reason: 'SECRET_STORAGE_INCOMPLETE',
          errorCode: '500',
        },
        ip,
        userAgent,
        keyRecord.id
      );

      throw new InternalServerErrorException(
        `API Key ${this.maskApiKey(apiKey)} has incomplete encrypted secret storage.`
      );
    }

    if (hasEncryptedSecret) {
      if (!this.secretEncryptionService.isMasterKeyConfigured()) {
        await this.writeAuditLog(
          {
            nonce: '',
            signature: '',
            timestamp: new Date().toISOString(),
            path: '',
            method: '',
            apiKey: this.maskApiKey(apiKey),
            reason: 'SECRET_MASTER_KEY_MISSING',
            errorCode: '500',
          },
          ip,
          userAgent,
          keyRecord.id
        );

        throw new InternalServerErrorException(
          `API Key ${this.maskApiKey(apiKey)} requires encrypted secret decryption, but API_KEY_MASTER_KEY_B64 is missing.`
        );
      }

      try {
        return this.secretEncryptionService.decryptSecret(
          keyRecord.secretEnc!,
          keyRecord.secretEncIv!,
          keyRecord.secretEncTag!
        );
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(
          `Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}: ${err.message}`
        );
        await this.writeAuditLog(
          {
            nonce: '',
            signature: '',
            timestamp: new Date().toISOString(),
            path: '',
            method: '',
            apiKey: this.maskApiKey(apiKey),
            reason: 'SECRET_DECRYPT_FAILED',
            errorCode: '500',
          },
          ip,
          userAgent,
          keyRecord.id
        );
        throw new InternalServerErrorException(
          `API Key ${this.maskApiKey(apiKey)} secret decryption failed.`
        );
      }
    }

    // 既没有加密字段也没有完整 triplet：错误
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
      `API Key ${this.maskApiKey(apiKey)} has no encrypted secret stored.`
    );
  }

  private async findApiKeyRecord(apiKey: string): Promise<any | null> {
    return this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: {
        ownerUser: true,
        ownerOrg: true,
      },
    });
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
