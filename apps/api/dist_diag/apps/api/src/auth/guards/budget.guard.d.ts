import { CanActivate, ExecutionContext } from '@nestjs/common';
import { BudgetService } from '../../billing/budget.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
export declare class BudgetGuard implements CanActivate {
    private readonly budgetService;
    private readonly auditLogService;
    private readonly logger;
    constructor(budgetService: BudgetService, auditLogService: AuditLogService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private recordAudit;
}
