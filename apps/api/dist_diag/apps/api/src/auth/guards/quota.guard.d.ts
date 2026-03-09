import { CanActivate, ExecutionContext } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
export declare class QuotaGuard implements CanActivate {
    private readonly billingService;
    private readonly auditLogService;
    private readonly logger;
    constructor(billingService: BillingService, auditLogService: AuditLogService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private recordBlockedAudit;
}
