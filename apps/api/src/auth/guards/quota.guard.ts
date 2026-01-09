import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { BillingService } from '../../billing/billing.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class QuotaGuard implements CanActivate {
    private readonly logger = new Logger(QuotaGuard.name);

    constructor(
        private readonly billingService: BillingService,
        private readonly auditLogService: AuditLogService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.apiKeyOwnerOrgId || user?.organizationId || request.headers['x-organization-id'];

        const nonce = request.hmacNonce || request.headers['x-nonce'] || request.headers['x-api-nonce'];
        const signature = request.hmacSignature || request.headers['x-signature'] || request.headers['x-api-signature'];
        const timestamp = request.hmacTimestamp || request.headers['x-timestamp'] || request.headers['x-api-timestamp'];

        // 1. 安全检查预置 (对齐规格)
        // 如果是 HMAC 模式且缺少关键头，即使还没到 Quota 检查，也要审计留痕
        if (!user && (!nonce || !signature)) {
            await this.recordBlockedAudit(request, organizationId, 'request.rejected.missing_signature', {
                nonce,
                signature,
                timestamp
            });
            // 注意：这里我们不抛出异常，让 JwtOrHmacGuard 去处理 401，
            // 或者如果 QuotaGuard 放在 JwtOrHmacGuard 之后，这里其实已经是有 user 的。
        }

        if (!organizationId) {
            this.logger.warn('QuotaGuard: No organizationId found in request');
            return true; // 允许通过，由后续权限逻辑处理或报错
        }

        // 2. 额度检查
        const hasQuota = await this.billingService.checkQuota(user?.userId, organizationId);

        if (!hasQuota) {
            await this.recordBlockedAudit(request, organizationId, 'job.create.blocked.quota', {
                credits: 0,
                reason: 'INSUFFICIENT_FUNDS'
            });

            throw new ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                message: 'Insufficient credits to create job. Please top up.',
                statusCode: 402,
            });
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
            details: {
                ...details,
                incomingNonce: request.hmacNonce || request.headers['x-nonce'],
                incomingSignature: request.hmacSignature || request.headers['x-signature'],
            },
            traceId: (request as any).traceId,
        }).catch(err => {
            this.logger.error(`Failed to record audit log for ${action}: ${err.message}`);
        });
    }
}
