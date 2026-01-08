import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { BudgetService, BudgetLevel } from '../../billing/budget.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class BudgetGuard implements CanActivate {
    private readonly logger = new Logger(BudgetGuard.name);

    constructor(
        private readonly budgetService: BudgetService,
        private readonly auditLogService: AuditLogService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.apiKeyOwnerOrgId || user?.organizationId;

        if (!organizationId) return true;

        const { ratio, level } = await this.budgetService.getBudgetStatus(organizationId);

        // 将预算级别注入请求，供 Router 或 Controller 决策降级 (P1-B 协作)
        request.budgetLevel = level;
        request.budgetRatio = ratio;

        if (level === BudgetLevel.BLOCK_ALL_CONSUME) {
            await this.recordBlockedAudit(request, organizationId, 'job.create.blocked.budget_120', { ratio });
            throw new ForbiddenException({
                code: 'BUDGET_EXCEEDED_120',
                message: 'Project budget exceeded (120%+). All consumable tasks blocked.',
                statusCode: 402,
            });
        }

        if (level === BudgetLevel.BLOCK_HIGH_COST) {
            this.logger.log(`Org ${organizationId} budget at 100%+. Marking for degradation (ratio: ${ratio.toFixed(2)}).`);
            // Note: 100% 时不直接拦截，除非业务逻辑在 Router 中发现不支持降级。
        }

        if (level === BudgetLevel.WARN) {
            this.logger.warn(`Org ${organizationId} budget reached 80% (ratio: ${ratio.toFixed(2)}).`);
        }

        return true;
    }

    private async recordBlockedAudit(request: any, orgId: string, action: string, details: any) {
        const requestInfo = AuditLogService.extractRequestInfo(request);
        await this.auditLogService.record({
            userId: request.user?.userId,
            apiKeyId: request.apiKeyId,
            action: action,
            resourceType: 'billing',
            resourceId: orgId,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: details,
            nonce: request.hmacNonce || request.headers['x-nonce'],
            signature: request.hmacSignature || request.headers['x-signature']
        }).catch(() => undefined);
    }
}
