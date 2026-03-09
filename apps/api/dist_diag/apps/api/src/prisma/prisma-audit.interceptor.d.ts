import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class PrismaQueryRawAuditInterceptor implements NestInterceptor {
    private readonly logger;
    private readonly isProduction;
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
export declare function auditQueryRaw(sql: string, params?: any[]): void;
