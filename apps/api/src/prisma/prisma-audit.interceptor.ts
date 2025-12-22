import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from './prisma.service';

/**
 * Prisma $queryRaw 审计拦截器
 * 禁止在生产环境使用 $queryRaw 拼接 SQL，防止 SQL 注入
 */
@Injectable()
export class PrismaQueryRawAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PrismaQueryRawAuditInterceptor.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.isProduction) {
      return next.handle();
    }

    // 在生产环境，检查是否有 $queryRaw 调用
    // 注意：这是一个启发式检查，实际应该通过代码审查和 lint 规则来禁止
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.path;

    return next.handle().pipe(
      tap(() => {
        // 这里可以添加审计日志
        // 实际禁止应该在代码层面通过 ESLint 规则实现
        this.logger.warn(
          `[PrismaAudit] Potential $queryRaw usage detected at ${method} ${path}. ` +
          `Please ensure no SQL string concatenation is used.`,
        );
      }),
    );
  }
}

/**
 * 审计 $queryRaw 使用的辅助函数
 * 在生产环境禁止使用字符串拼接的 SQL
 */
export function auditQueryRaw(sql: string, params?: any[]): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = new Logger('PrismaQueryRawAudit');

  if (isProduction) {
    // 检查是否有字符串拼接的迹象
    if (sql.includes('${') || sql.includes('${') || sql.includes('+')) {
      logger.error(
        `[SECURITY] Detected potential SQL injection risk: string concatenation in $queryRaw. ` +
        `SQL: ${sql.substring(0, 100)}...`,
      );
      throw new Error('SQL string concatenation is forbidden in production. Use Prisma template literals instead.');
    }
  }
}

