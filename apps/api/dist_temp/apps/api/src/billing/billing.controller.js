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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("./billing.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const billing_settlement_service_1 = require("./billing-settlement.service");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
let BillingController = class BillingController {
    billingService;
    billingSettlementService;
    constructor(billingService, billingSettlementService) {
        this.billingService = billingService;
        this.billingSettlementService = billingSettlementService;
    }
    async subscribe(user, planId) {
        return this.billingService.createSubscription(user.userId, planId);
    }
    async getSubscription(user) {
        return this.billingService.getSubscription(user.userId);
    }
    async getPlans() {
        return this.billingService.getPlans();
    }
    async settle(user, organizationId, projectId) {
        if (!organizationId)
            throw new common_1.BadRequestException('Organization context missing');
        return this.billingSettlementService.settleProject(projectId);
    }
    async getEvents(organizationId, projectId, from, to, type, page, pageSize) {
        if (!organizationId)
            throw new common_1.BadRequestException('Organization context missing');
        return this.billingService.getEvents({
            projectId,
            orgId: organizationId,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
            type,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
        });
    }
    async getLedgers(organizationId, projectId, status, jobType, from, to, page, pageSize) {
        if (!organizationId)
            throw new common_1.BadRequestException('Organization context missing');
        return this.billingService.getLedgers({
            projectId,
            status,
            jobType,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
        });
    }
    async getSummary(organizationId, projectId) {
        if (!organizationId)
            throw new common_1.BadRequestException('Organization context missing');
        return this.billingService.getSummary(projectId, organizationId);
    }
    async getReconcileStatus(organizationId, projectId) {
        if (!organizationId)
            throw new common_1.BadRequestException('Organization context missing');
        if (!projectId)
            throw new common_1.BadRequestException('projectId is required');
        return this.billingService.getReconcileStatus(projectId);
    }
    async getGpuRoiAnalytics(timeWindowHours) {
        return this.billingService.getGpuRoiAnalytics({
            timeWindowHours: Number(timeWindowHours || 24),
        });
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('subscribe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Get)('subscription'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)('settle'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(2, (0, common_1.Body)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "settle", null);
__decorate([
    (0, common_1.Get)('events'),
    __param(0, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('type')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getEvents", null);
__decorate([
    (0, common_1.Get)('ledgers'),
    __param(0, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('jobType')),
    __param(4, (0, common_1.Query)('from')),
    __param(5, (0, common_1.Query)('to')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getLedgers", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(1, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('reconcile/status'),
    __param(0, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(1, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getReconcileStatus", null);
__decorate([
    (0, common_1.Get)('analytics/gpu-roi'),
    __param(0, (0, common_1.Query)('timeWindowHours')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getGpuRoiAnalytics", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)('billing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService,
        billing_settlement_service_1.BillingSettlementService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map