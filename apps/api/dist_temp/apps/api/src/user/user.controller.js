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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const organization_service_1 = require("../organization/organization.service");
const crypto_1 = require("crypto");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let UserController = class UserController {
    userService;
    organizationService;
    auditLogService;
    constructor(userService, organizationService, auditLogService) {
        this.userService = userService;
        this.organizationService = organizationService;
        this.auditLogService = auditLogService;
    }
    async getCurrentUser(user) {
        const userData = await this.userService.findById(user.userId);
        const currentOrganizationId = await this.organizationService.getCurrentOrganization(user.userId);
        const organizations = await this.organizationService.getUserOrganizations(user.userId);
        return {
            success: true,
            data: {
                ...userData,
                currentOrganizationId,
                organizations,
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async switchOrganization(body, user, request) {
        const result = await this.organizationService.switchOrganization(user.userId, body.organizationId);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.ORGANIZATION_SWITCH,
            resourceType: 'organization',
            resourceId: body.organizationId,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
                organizationName: result.organization?.name,
                role: result.role,
            },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getQuota(user) {
        const quota = await this.userService.getQuota(user.userId);
        return {
            success: true,
            data: quota,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getCurrentUser", null);
__decorate([
    (0, common_1.Post)('me/organizations/switch'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.ORGANIZATION_SWITCH),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "switchOrganization", null);
__decorate([
    (0, common_1.Get)('quota'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getQuota", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [user_service_1.UserService,
        organization_service_1.OrganizationService,
        audit_log_service_1.AuditLogService])
], UserController);
//# sourceMappingURL=user.controller.js.map