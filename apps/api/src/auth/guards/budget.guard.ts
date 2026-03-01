import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { BudgetService, BudgetLevel } from '../../billing/budget.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class BudgetGuard implements CanActivate {
  private readonly logger = new Logger(BudgetGuard.name);

  constructor(
    @Inject(BudgetService)
    private readonly budgetService: BudgetService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

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
      await this.recordAudit(request, organizationId, 'job.create.blocked.budget_120', { ratio });
      throw new ForbiddenException({
        code: 'BUDGET_EXCEEDED_120',
        message: 'Project budget exceeded (120%+). All consumable tasks blocked.',
        statusCode: 402,
      });
    }

    const jobType = request.body?.type;
    const HIGH_COST_TYPES = ['VIDEO_RENDER', 'CE05_DIRECTOR_CONTROL'];

    if (level === BudgetLevel.BLOCK_HIGH_COST) {
      this.logger.log(`Org ${organizationId} budget at 100%+. Checking job type: ${jobType}`);
      if (HIGH_COST_TYPES.includes(jobType)) {
        await this.recordAudit(request, organizationId, 'job.create.blocked.budget_100_highcost', {
          ratio,
          jobType,
        });
        throw new ForbiddenException({
          code: 'BUDGET_EXCEEDED_100',
          message: `Project budget exceeded (100%+). High-cost task ${jobType} blocked.`,
          statusCode: 402,
        });
      } else {
        await this.recordAudit(request, organizationId, 'job.create.allow.budget_100_standard', {
          ratio,
          jobType,
        });
      }
    }

    if (level === BudgetLevel.WARN) {
      this.logger.warn(`Org ${organizationId} budget reached 80% (ratio: ${ratio.toFixed(2)}).`);
      await this.recordAudit(request, organizationId, 'job.create.warn.budget_80', { ratio });
    }

    return true;
  }

  private async recordAudit(request: any, orgId: string, action: string, details: any) {
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const tsHeader = request.headers['x-timestamp'];
    const timestamp = tsHeader ? new Date(parseInt(tsHeader)) : undefined;

    await this.auditLogService
      .record({
        userId: request.user?.userId,
        apiKeyId: request.apiKeyId,
        action: action,
        resourceType: 'billing',
        resourceId: orgId,
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
        details: {
          ...details,
          incomingNonce: request.hmacNonce || request.headers['x-nonce'],
          incomingSignature: request.hmacSignature || request.headers['x-signature'],
          incomingTimestamp: request.headers['x-timestamp'],
        },
        traceId: (request as any).traceId,
      })
      .catch((err) => {
        this.logger.error(`Failed to record audit log ${action}: ${err.message}`, err.stack);
        // Non-blocking but visible error
      });
  }
}
