import { Injectable, CanActivate, ExecutionContext, BadRequestException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { HmacAuthService } from './hmac-auth.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditActions } from '../../audit/audit.constants';
import { NonceService } from '../nonce.service';
import { buildHmacError } from '../../common/utils/hmac-error.utils';

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
    private readonly hmacAuthService: HmacAuthService,
    private readonly auditLogService: AuditLogService,
    private readonly nonceService: NonceService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // P1-1: 门禁模式旁路已移除（封板收口）
    // 强制回到 Spec：所有请求必须通过 HMAC 签名验证

    const method = request.method;
    // 商业级规范：验签path必须来自实际请求行（originalUrl优先）
    // 不能从workerId/route param拼接，不能使用默认值
    const path = request.originalUrl || request.url || '';

    // DEBUG: 输出所有path相关字段以定位问题
    if (process.env.HMAC_TRACE === '1') {
      this.logger.error(`[HMAC_TRACE] path_debug: ${JSON.stringify({
        originalUrl: request.originalUrl,
        url: request.url,
        path: request.path,
        baseUrl: request.baseUrl,
        route_path: (request as any).route?.path,
        computed_path: path,
      })}`);
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

    // 2. 检查必需的头字段 (apiKey 和 signature 是绝对必需的)
    if (!apiKey || !signature) {
      throw buildHmacError('4003', '缺少必需的认证头：X-Api-Key, X-Signature', { path, method });
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

    // 3. 获取原始 body 字符串
    const hasBodyObject =
      request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0;
    const bodyString =
      typeof request.body === 'string'
        ? request.body
        : hasBodyObject
          ? JSON.stringify(request.body)
          : '';

    // HMAC_TRACE: Guard入口必达日志
    if (process.env.HMAC_TRACE === '1') {
      this.logger.error(`[HMAC_TRACE] guard_enter: ${JSON.stringify({
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasSig: !!request.headers['x-signature'],
        hasV: !!request.headers['x-hmac-version'],
        hasWorker: !!request.headers['x-worker-id'],
      })}`);
    }

    // 4. 可选调试日志（仅非生产环境）
    if (process.env.NODE_ENV !== 'production') {
      /* eslint-disable no-console */
      this.logger.log(`[HMAC DEBUG]: ${JSON.stringify({
        method,
        path,
        headers: {
          'x-api-key': apiKey,
          'x-nonce': nonce,
          'x-timestamp': timestamp,
          'x-signature': signature,
        },
        bodyString,
      })}`);
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

      // 7. 将 ApiKey 信息附加到请求对象，供后续使用
      (request as any).apiKey = keyRecord;
      (request as any).apiKeyId = keyRecord.id;
      (request as any).apiKeyOwnerUserId = keyRecord.ownerUserId;
      (request as any).apiKeyOwnerOrgId = keyRecord.ownerOrgId;
      (request as any).hmacNonce = nonce;
      (request as any).hmacTimestamp = timestamp;
      (request as any).hmacSignature = signature;
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
      } else {
        // Explicitly mark as having no user bound
        (request as any).user = null;
        (request as any).authHasUser = false;
      }

      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[SMOKE_KEY_RESOLVE]: ${JSON.stringify({
          apiKeyKey: keyRecord.key,
          apiKeyId: keyRecord.id,
          ownerUserId: keyRecord.ownerUserId,
          ownerOrgId: keyRecord.ownerOrgId,
        })}`);
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
