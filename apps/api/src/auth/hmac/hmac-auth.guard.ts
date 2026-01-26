import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Request } from 'express';
import { HmacAuthService } from './hmac-auth.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditActions } from '../../audit/audit.constants';
import { NonceService } from '../nonce.service';
import { buildHmacError } from '../../common/utils/hmac-error.utils';
import { RequestWithApiSecurity } from '../../security/api-security/api-security.types';

/**
 * HMAC 认证 Guard
 * 用于验证 API Key + HMAC 签名
 *
 * 使用方式：
 * @UseGuards(HmacAuthGuard)
 *
 * 签名规则：
 * 1. 构建消息：${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}
 * 2. 计算签名：HMAC_SHA256(secret, message)，输出十六进制
 * 3. 在 HTTP 头中传递：
 *    - X-API-KEY: 公钥 ID
 *    - X-API-NONCE: 随机字符串
 *    - X-API-TIMESTAMP: 时间戳（毫秒）
 *    - X-API-SIGNATURE: 计算得到的签名
 */
@Injectable()
export class HmacAuthGuard implements CanActivate {
  private readonly logger = new Logger(HmacAuthGuard.name);
  constructor(
    @Inject(forwardRef(() => HmacAuthService))
    private readonly hmacAuthService: HmacAuthService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => NonceService))
    private readonly nonceService: NonceService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiSecurity>();

    // P1-1: 门禁模式旁路已移除（封板收口）
    // 强制回到 Spec：所有请求必须通过 HMAC 签名验证

    // P0-FIX: 避免与 ApiSecurityGuard 重复验证导致 Nonce 冲突
    // 如果 request.apiKey 已经存在，说明前序 Guard (ApiSecurityGuard) 已完成验证
    if ((request as any).apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[HMAC_GUARD] Skipping validation, already validated by upstream Guard`);
      }

      // P0-FIX: Hydrate User Context from Upstream Record
      const upstreamRecord = (request as any).apiKeyRecord;
      if (upstreamRecord?.ownerUser) {
        (request as any).user = {
          userId: upstreamRecord.ownerUser.id,
          id: upstreamRecord.ownerUser.id,
          email: upstreamRecord.ownerUser.email,
          userType: upstreamRecord.ownerUser.userType || 'USER',
          role: upstreamRecord.ownerUser.role || 'USER',
          tier: upstreamRecord.ownerUser.tier || 'FREE',
          organizationId: upstreamRecord.ownerOrgId,
        };
        (request as any).authType = 'hmac';
      }
      return true;
    }

    const method = request.method;
    // 商业级规范：验签path必须来自实际请求行（originalUrl优先）
    // 不能从workerId/route param拼接，不能使用默认值
    const path = request.originalUrl || request.url || '';

    // DEBUG: 输出所有path相关字段以定位问题
    if (process.env.HMAC_TRACE === '1') {
      this.logger.error(
        `[HMAC_TRACE] path_debug: ${JSON.stringify({
          originalUrl: request.originalUrl,
          url: request.url,
          path: request.path,
          baseUrl: request.baseUrl,
          route_path: (request as any).route?.path,
          computed_path: path,
        })}`
      );
    }

    // 1. 提取 HTTP 头
    const apiKey = (request.headers['x-api-key'] ||
      request.headers['x-api-key'.toLowerCase()] ||
      request.headers['x-api-key']) as string;
    const nonce = (request.headers['x-nonce'] || request.headers['x-api-nonce']) as string;
    const timestamp = (request.headers['x-timestamp'] ||
      request.headers['x-api-timestamp']) as string;
    const signature = (request.headers['x-signature'] ||
      request.headers['x-api-signature']) as string;
    const hmacVersion = request.headers['x-hmac-version'] as string;

    // 2. 检查必需的头字段 (apiKey 和 signature 是绝对必需的)
    if (!apiKey || !signature) {
      throw buildHmacError('4003', '缺少必需的认证头：X-Api-Key, X-Signature', { path, method });
    }

    // 2.2 时间戳校验 (P0 - APISpec V1.1 Strict Seconds)
    const tsNum = Number(timestamp);
    this.logger.warn(
      `[HMAC_GUARD_WARN] Incoming timestamp: ${timestamp} (type: ${typeof timestamp}), parsed: ${tsNum}`
    );

    if (!timestamp || isNaN(tsNum)) {
      throw buildHmacError('4003', 'Invalid or missing X-Timestamp', { path, method });
    }
    if (tsNum > 10000000000) {
      this.logger.error(`[HMAC_GUARD_REJECT] REJECTING MS TIMESTAMP: ${tsNum} > 10000000000`);
      throw buildHmacError('4003', 'timestamp_must_be_seconds', { path, method });
    }

    // 2.5 防重放校验 (P0) - 兼容启用
    // 仅在请求中提供了 nonce 和 timestamp 时才进行校验和持久化
    const hasNonceInfo = !!(nonce && timestamp);
    if (hasNonceInfo) {
      try {
        await this.nonceService.assertAndStoreNonce(nonce, apiKey, Number(timestamp), {
          path,
          method,
          ip: request.ip,
          ua: request.headers['user-agent'] as string,
        });
      } catch (error: any) {
        // 如果是 NonceService 抛出的已重放错误，直接重新包装并抛出
        if (error?.message?.includes('REPLAY') || error?.message?.includes('replay')) {
          // 确保错误消息包含可 grep 的 NONCE_REPLAY 标识
          throw buildHmacError('4004', 'NONCE_REPLAY: Nonce replay detected', { path, method });
        }
        throw error;
      }
    }

    // 3. 获取原始 body 字符串 (P0: 优先使用 rawBody 以匹配签名)
    let bodyString = '';
    if (request.rawBody) {
      bodyString = Buffer.isBuffer(request.rawBody)
        ? request.rawBody.toString('utf8')
        : String(request.rawBody);
    } else {
      const hasBodyObject =
        request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0;
      bodyString =
        typeof request.body === 'string'
          ? request.body
          : hasBodyObject
            ? JSON.stringify(request.body)
            : '';
    }

    // HMAC_TRACE: Guard入口必达日志
    if (process.env.HMAC_TRACE === '1') {
      this.logger.error(
        `[HMAC_TRACE] guard_enter: ${JSON.stringify({
          path: request.originalUrl ?? request.url,
          method: request.method,
          hasSig: !!request.headers['x-signature'],
          hasV: !!request.headers['x-hmac-version'],
          hasWorker: !!request.headers['x-worker-id'],
        })}`
      );
    }

    // 4. 可选调试日志（仅非生产环境）
    if (process.env.NODE_ENV !== 'production') {
      /* eslint-disable no-console */
      this.logger.log(
        `[HMAC DEBUG]: ${JSON.stringify({
          method,
          path,
          headers: {
            'x-api-key': apiKey,
            'x-nonce': nonce,
            'x-timestamp': timestamp,
            'x-signature': signature,
          },
          bodyString,
        })}`
      );
      /* eslint-enable no-console */
    }

    // 5. 验证签名
    try {
      const keyRecord = await this.hmacAuthService.verifySignature(
        apiKey,
        method,
        path,
        bodyString,
        nonce,
        timestamp,
        signature,
        {
          ip: request.ip || (request.headers['x-forwarded-for'] as string),
          ua: request.headers['user-agent'] as string,
          workerId: request.headers['x-worker-id'] as string,
        }
      );

      this.logger.log(
        `[HMAC_AUTH] ApiKey ownerOrgId: ${keyRecord.ownerOrgId}, ownerUserId: ${keyRecord.ownerUserId}`
      );
      // 7. 将 ApiKey 信息附加到请求对象，供后续使用
      (request as any).apiKey = keyRecord;
      (request as any).apiKeyId = keyRecord.id;
      (request as any).apiKeyOwnerUserId = keyRecord.ownerUserId;
      (request as any).apiKeyOwnerOrgId = keyRecord.ownerOrgId;
      (request as any).hmacNonce = nonce;
      (request as any).hmacTimestamp = timestamp;
      (request as any).hmacSignature = signature;
      (request as any).hmac = {
        apiKey,
        nonce,
        timestamp,
        signature,
      };
      (request as any).authType = 'hmac'; // Identity marker for audit/logic

      if (keyRecord.ownerUser) {
        (request as any).user = {
          userId: keyRecord.ownerUser.id,
          id: keyRecord.ownerUser.id, // Compatibility
          email: keyRecord.ownerUser.email,
          userType: keyRecord.ownerUser.userType || 'USER', // Fallback
          role: keyRecord.ownerUser.role || 'USER', // Fallback
          tier: keyRecord.ownerUser.tier || 'FREE', // Fallback
          organizationId: keyRecord.ownerOrgId, // Implicit context
        };
        this.logger.log(
          `[HMAC_AUTH] Resolved user: ${keyRecord.ownerUser.id}, org: ${keyRecord.ownerOrgId}`
        );
      } else {
        // Explicitly mark as having no user bound
        (request as any).user = null;
        (request as any).authHasUser = false;
      }

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[SMOKE_KEY_RESOLVE]: ${JSON.stringify({
            apiKeyKey: keyRecord.key,
            apiKeyId: keyRecord.id,
            ownerUserId: keyRecord.ownerUserId,
            ownerOrgId: keyRecord.ownerOrgId,
          })}`
        );
        this.logger.log(`[HMAC_GUARD_USER] request.user: ${JSON.stringify((request as any).user)}`);
      }

      return true;
    } catch (error: any) {
      // 写审计：签名失败
      const requestInfo = AuditLogService.extractRequestInfo(request);
      await this.auditLogService
        .record({
          apiKeyId: undefined,
          action: AuditActions.SECURITY_EVENT,
          resourceType: 'api_security',
          resourceId: apiKey,
          ip: requestInfo.ip,
          userAgent: requestInfo.userAgent,
          details: {
            reason: 'HMAC_AUTH_FAILED',
            path,
            method,
            message: error?.response?.error?.message || error?.message,
            code: error?.response?.error?.code || '4003',
            incomingNonce: nonce,
            incomingSignature: signature,
          },
          traceId: (request as any).traceId,
        })
        .catch(() => undefined);
      throw error;
    }
  }
}
