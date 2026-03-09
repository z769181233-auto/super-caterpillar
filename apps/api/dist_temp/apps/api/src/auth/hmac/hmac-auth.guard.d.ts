import { CanActivate, ExecutionContext } from '@nestjs/common';
import { HmacAuthService } from './hmac-auth.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { NonceService } from '../nonce.service';
export declare class HmacAuthGuard implements CanActivate {
    private readonly hmacAuthService;
    private readonly auditLogService;
    private readonly nonceService;
    private readonly logger;
    constructor(hmacAuthService: HmacAuthService, auditLogService: AuditLogService, nonceService: NonceService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
