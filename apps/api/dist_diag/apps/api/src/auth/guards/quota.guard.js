"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var QuotaGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaGuard = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("../../billing/billing.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
let QuotaGuard = QuotaGuard_1 = class QuotaGuard {
    billingService;
    auditLogService;
    logger = new common_1.Logger(QuotaGuard_1.name);
    constructor(billingService, auditLogService) {
        this.billingService = billingService;
        this.auditLogService = auditLogService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.apiKeyOwnerOrgId || user?.organizationId || request.headers['x-organization-id'];
        const nonce = request.hmacNonce || request.headers['x-nonce'] || request.headers['x-api-nonce'];
        const signature = request.hmacSignature || request.headers['x-signature'] || request.headers['x-api-signature'];
        const timestamp = request.hmacTimestamp || request.headers['x-timestamp'] || request.headers['x-api-timestamp'];
        if (!user && (!nonce || !signature)) {
            await this.recordBlockedAudit(request, organizationId, 'request.rejected.missing_signature', {
                nonce,
                signature,
                timestamp,
            });
        }
        if (!organizationId) {
            this.logger.warn('QuotaGuard: No organizationId found in request');
            return true;
        }
        const hasQuota = await this.billingService.checkQuota(user?.userId, organizationId);
        if (!hasQuota) {
            await this.recordBlockedAudit(request, organizationId, 'job.create.blocked.quota', {
                credits: 0,
                reason: 'INSUFFICIENT_FUNDS',
            });
            throw new common_1.ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                message: 'Insufficient credits to create job. Please top up.',
                statusCode: 402,
            });
        }
        return true;
    }
    async recordBlockedAudit(request, orgId, action, details) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
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
            },
            traceId: request.traceId,
        })
            .catch((err) => {
            this.logger.error(`Failed to record audit log for ${action}: ${err.message}`);
        });
    }
};
exports.QuotaGuard = QuotaGuard;
exports.QuotaGuard = QuotaGuard = QuotaGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(billing_service_1.BillingService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        audit_log_service_1.AuditLogService])
], QuotaGuard);
//# sourceMappingURL=quota.guard.js.map