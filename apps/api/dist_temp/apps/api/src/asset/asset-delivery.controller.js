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
var AssetDeliveryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetDeliveryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
let AssetDeliveryController = AssetDeliveryController_1 = class AssetDeliveryController {
    prisma;
    auditLogService;
    logger = new common_1.Logger(AssetDeliveryController_1.name);
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async getSecureUrl(assetId, user, organizationId) {
        const asset = await this.prisma.asset.findFirst({
            where: {
                id: assetId,
                project: {
                    organizationId,
                },
            },
        });
        if (!asset) {
            throw new common_1.NotFoundException('Asset not found');
        }
        if (!asset.signedUrl) {
            throw new common_1.NotFoundException('Signed URL not generated for this asset yet');
        }
        await this.auditLogService.record({
            userId: user.userId,
            orgId: organizationId,
            action: 'ASSET_SIGNED_URL_ACCESS',
            resourceType: 'asset',
            resourceId: assetId,
            details: {
                type: asset.type,
            },
        });
        return {
            success: true,
            data: {
                signed_url: asset.signedUrl,
                signedUrl: asset.signedUrl,
                url: asset.signedUrl,
                expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                expire: 3600,
            },
        };
    }
    async getHls(assetId, user, organizationId) {
        const asset = await this.prisma.asset.findFirst({
            where: {
                id: assetId,
                project: {
                    organizationId,
                },
            },
        });
        if (!asset) {
            throw new common_1.NotFoundException('Asset not found');
        }
        if (!asset.hlsPlaylistUrl) {
            throw new common_1.NotFoundException('HLS playlist not generated for this asset yet');
        }
        await this.auditLogService.record({
            userId: user.userId,
            orgId: organizationId,
            action: 'ASSET_HLS_ACCESS',
            resourceType: 'asset',
            resourceId: assetId,
        });
        return {
            success: true,
            data: {
                playlistUrl: asset.hlsPlaylistUrl,
                watermarkMode: asset.watermarkMode,
                fingerprintId: asset.fingerprintId,
            },
        };
    }
};
exports.AssetDeliveryController = AssetDeliveryController;
__decorate([
    (0, common_1.Get)(':id/secure-url'),
    (0, common_1.Get)(':id/signed-url'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AssetDeliveryController.prototype, "getSecureUrl", null);
__decorate([
    (0, common_1.Get)(':id/hls'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AssetDeliveryController.prototype, "getHls", null);
exports.AssetDeliveryController = AssetDeliveryController = AssetDeliveryController_1 = __decorate([
    (0, common_1.Controller)('assets'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], AssetDeliveryController);
//# sourceMappingURL=asset-delivery.controller.js.map