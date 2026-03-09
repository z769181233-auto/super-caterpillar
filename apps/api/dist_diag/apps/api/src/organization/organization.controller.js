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
exports.OrganizationController = void 0;
const common_1 = require("@nestjs/common");
const organization_service_1 = require("./organization.service");
const auth_service_1 = require("../auth/auth.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const crypto_1 = require("crypto");
const config_1 = require("@scu/config");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let OrganizationController = class OrganizationController {
    organizationService;
    authService;
    auditLogService;
    constructor(organizationService, authService, auditLogService) {
        this.organizationService = organizationService;
        this.authService = authService;
        this.auditLogService = auditLogService;
    }
    async getUserOrganizations(user) {
        const organizations = await this.organizationService.getUserOrganizations(user.userId);
        return {
            success: true,
            data: organizations,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createOrganization(body, user) {
        const organization = await this.organizationService.createOrganization(user.userId, body.name, body.slug);
        return {
            success: true,
            data: organization,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getOrganization(id, user) {
        const organization = await this.organizationService.getOrganizationById(id, user.userId);
        return {
            success: true,
            data: organization,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async switchOrganization(body, user, res, request) {
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
        const tokens = await this.authService.generateTokens(user.userId, user.email, user.tier, body.organizationId);
        const isProduction = config_1.env.isProduction;
        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        if (tokens.refreshToken) {
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
        }
        return {
            success: true,
            data: {
                ...result,
                message: `Switched to organization ${result.organization?.name || result.organizationId}`,
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.OrganizationController = OrganizationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getUserOrganizations", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "createOrganization", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "getOrganization", null);
__decorate([
    (0, common_1.Post)('switch'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.ORGANIZATION_SWITCH),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], OrganizationController.prototype, "switchOrganization", null);
exports.OrganizationController = OrganizationController = __decorate([
    (0, common_1.Controller)('organizations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [organization_service_1.OrganizationService,
        auth_service_1.AuthService,
        audit_log_service_1.AuditLogService])
], OrganizationController);
//# sourceMappingURL=organization.controller.js.map