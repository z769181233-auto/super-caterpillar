import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService
  ) {}

  private asNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    try {
      if (context.getType() === 'http') {
        const req = context.switchToHttp().getRequest();
        if (req.method === 'OPTIONS') return next.handle();
      }

      const handler = context.getHandler();
      const cls = context.getClass();
      if (!handler || !cls) return next.handle();

      const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [handler, cls]);
      if (!action) {
        return next.handle();
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user;
      const traceId =
        this.asNonEmptyString(request.traceId) ??
        this.asNonEmptyString(request.headers['x-trace-id']);
      const ip = request.ip || request.headers['x-forwarded-for'];
      const ua = request.headers['user-agent'];
      const resourceType =
        this.asNonEmptyString(request?.route?.path) ?? this.asNonEmptyString(request.url);

      return next.handle().pipe(
        tap(async () => {
          await this.auditService.log({
            userId: user?.userId,
            organizationId: user?.organizationId,
            action,
            resourceType,
            resourceId: request.params?.id || request.params?.projectId || null,
            traceId,
            ip: typeof ip === 'string' ? ip : Array.isArray(ip) ? ip[0] : undefined,
            userAgent: typeof ua === 'string' ? ua : undefined,
            details: {
              method: request.method,
              path: request.url,
            },
          });
        })
      );
    } catch (e) {
      return next.handle();
    }
  }
}
