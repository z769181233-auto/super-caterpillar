import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditActions } from '../../audit/audit.constants';
import { CapacityExceededException, CapacityErrorMessages } from '../errors/capacity-errors';
import { maskSensitiveData, maskSensitiveString } from '../utils/sensitive-data-masker';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(@Inject(AuditLogService) private readonly auditLogService: AuditLogService) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp ? exception.getResponse() : { message: 'Internal server error' };
    this.logger.error(`[FILTER_DEBUG] Status: ${status}, Payload: ${JSON.stringify(payload)}`);
    const err = exception as any;
    const errorBody = typeof payload === 'object' ? payload : { message: payload };
    const errorCode = (errorBody as any)?.error?.code;

    // 处理容量超限异常
    if (exception instanceof CapacityExceededException) {
      const capacityError = exception as CapacityExceededException;
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: capacityError.errorCode,
          message: CapacityErrorMessages[capacityError.errorCode],
          currentCount: capacityError.currentCount,
          limit: capacityError.limit,
        },
      });
    }

    // 预期安全拒绝（4003/4004/401/403）：降噪处理，不打堆栈
    const isExpectedSecurityRejection =
      status === 401 || status === 403 || errorCode === '4003' || errorCode === '4004';

    if (isExpectedSecurityRejection) {
      // 结构化日志（warn 级别，不打堆栈）
      const securityContext = {
        tag: 'SECURITY_REJECTION',
        method: req.method,
        path: req.originalUrl || req.url,
        status,
        code: errorCode,
        message: (errorBody as any)?.error?.message || err?.message,
        userId: (req as any).user?.id || (req as any).user?.userId,
        apiKeyId: (req as any).apiKeyId,
        nonce: req.headers['x-nonce'] || (req as any).hmac?.nonce,
        timestamp: req.headers['x-timestamp'] || (req as any).hmac?.timestamp,
        ip:
          req.ip ||
          (Array.isArray(req.headers['x-forwarded-for'])
            ? req.headers['x-forwarded-for'][0]
            : req.headers['x-forwarded-for']) ||
          undefined,
        ua: req.headers['user-agent'] || undefined,
      };

      this.logger.warn(JSON.stringify(securityContext, null, 2));

      // 写入 audit_logs（符合 SafetySpec 要求）
      const auditAction =
        errorCode === '4004'
          ? 'API_NONCE_REPLAY'
          : errorCode === '4003'
            ? 'API_SIGNATURE_ERROR'
            : status === 403
              ? 'API_FORBIDDEN'
              : 'API_UNAUTHORIZED';

      this.auditLogService
        .record({
          userId: securityContext.userId,
          apiKeyId: securityContext.apiKeyId,
          action: auditAction,
          resourceType: 'api',
          resourceId: undefined,
          ip: securityContext.ip,
          userAgent: securityContext.ua,
          details: {
            path: securityContext.path,
            method: securityContext.method,
            code: errorCode,
            message: securityContext.message,
            incomingNonce: securityContext.nonce,
            incomingSignature: req.headers['x-signature'] || (req as any).hmac?.signature,
            incomingTimestamp: securityContext.timestamp,
          },
        })
        .catch((auditErr) => {
          // 审计失败不阻断，但记录警告
          this.logger.warn('Failed to write audit log for security rejection', auditErr);
        });
    } else {
      // P1 修复：生产环境脱敏，不输出全量堆栈
      const isProduction = process.env.NODE_ENV === 'production';
      const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (isProduction) {
        // 生产环境：仅记录错误 ID 和基本信息，不输出堆栈
        this.logger.error(
          JSON.stringify(
            {
              tag: 'UNHANDLED_EXCEPTION',
              errorId, // 用于追踪的错误 ID
              method: req.method,
              url: req.originalUrl || req.url,
              status,
              name: err?.name,
              message: maskSensitiveString(err?.message), // P1 修复：脱敏消息内容
              // 不输出 stack 和 payload（可能包含敏感信息）
            },
            null,
            2
          )
        );
      } else {
        // 开发环境：输出完整信息（包括堆栈）
        this.logger.error(
          JSON.stringify(
            {
              tag: 'UNHANDLED_EXCEPTION',
              errorId,
              method: req.method,
              url: req.originalUrl || req.url,
              status,
              payload: maskSensitiveData(payload), // P1 修复：脱敏 payload
              name: err?.name,
              message: maskSensitiveString(err?.message), // P1 修复：脱敏消息内容
              stack: err?.stack,
            },
            null,
            2
          )
        );
      }
    }

    res
      .status(status)
      .json(typeof payload === 'string' ? { statusCode: status, message: payload } : payload);
  }
}
