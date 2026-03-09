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
var BudgetGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetGuard = void 0;
const common_1 = require("@nestjs/common");
const budget_service_1 = require("../../billing/budget.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
let BudgetGuard = BudgetGuard_1 = class BudgetGuard {
    budgetService;
    auditLogService;
    logger = new common_1.Logger(BudgetGuard_1.name);
    constructor(budgetService, auditLogService) {
        this.budgetService = budgetService;
        this.auditLogService = auditLogService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.apiKeyOwnerOrgId || user?.organizationId;
        if (!organizationId)
            return true;
        const { ratio, level } = await this.budgetService.getBudgetStatus(organizationId);
        request.budgetLevel = level;
        request.budgetRatio = ratio;
        if (level === budget_service_1.BudgetLevel.BLOCK_ALL_CONSUME) {
            await this.recordAudit(request, organizationId, 'job.create.blocked.budget_120', { ratio });
            throw new common_1.ForbiddenException({
                code: 'BUDGET_EXCEEDED_120',
                message: 'Project budget exceeded (120%+). All consumable tasks blocked.',
                statusCode: 402,
            });
        }
        const jobType = request.body?.type;
        const HIGH_COST_TYPES = ['VIDEO_RENDER', 'CE05_DIRECTOR_CONTROL'];
        if (level === budget_service_1.BudgetLevel.BLOCK_HIGH_COST) {
            this.logger.log(`Org ${organizationId} budget at 100%+. Checking job type: ${jobType}`);
            if (HIGH_COST_TYPES.includes(jobType)) {
                await this.recordAudit(request, organizationId, 'job.create.blocked.budget_100_highcost', {
                    ratio,
                    jobType,
                });
                throw new common_1.ForbiddenException({
                    code: 'BUDGET_EXCEEDED_100',
                    message: `Project budget exceeded (100%+). High-cost task ${jobType} blocked.`,
                    statusCode: 402,
                });
            }
            else {
                await this.recordAudit(request, organizationId, 'job.create.allow.budget_100_standard', {
                    ratio,
                    jobType,
                });
            }
        }
        if (level === budget_service_1.BudgetLevel.WARN) {
            this.logger.warn(`Org ${organizationId} budget reached 80% (ratio: ${ratio.toFixed(2)}).`);
            await this.recordAudit(request, organizationId, 'job.create.warn.budget_80', { ratio });
        }
        return true;
    }
    async recordAudit(request, orgId, action, details) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
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
            traceId: request.traceId,
        })
            .catch((err) => {
            this.logger.error(`Failed to record audit log ${action}: ${err.message}`, err.stack);
        });
    }
};
exports.BudgetGuard = BudgetGuard;
exports.BudgetGuard = BudgetGuard = BudgetGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(budget_service_1.BudgetService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [budget_service_1.BudgetService,
        audit_log_service_1.AuditLogService])
], BudgetGuard);
//# sourceMappingURL=budget.guard.js.map