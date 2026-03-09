import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AuditLogService } from '../../audit-log/audit-log.service';
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly auditLogService;
    private readonly logger;
    constructor(auditLogService: AuditLogService);
    catch(exception: unknown, host: ArgumentsHost): Response<any, Record<string, any>> | undefined;
}
