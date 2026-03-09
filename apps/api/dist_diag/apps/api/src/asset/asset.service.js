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
var AssetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let AssetService = AssetService_1 = class AssetService {
    prisma;
    auditLogService;
    logger = new common_1.Logger(AssetService_1.name);
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async getSecureUrl(assetId, userId) {
        const asset = await this.prisma.asset.findUnique({
            where: { id: assetId },
        });
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${assetId} not found`);
        }
        if (userId) {
            await this.assertAssetAccessible(userId, assetId);
        }
        await this.auditLogService.record({
            userId,
            action: 'ASSET_ACCESS',
            resourceType: 'asset',
            resourceId: assetId,
            details: { operation: 'getSecureUrl' },
        });
        let secureUrl = asset.storageKey;
        if (!secureUrl.startsWith('http')) {
            secureUrl = `http://localhost:3000/uploads/${asset.storageKey}`;
        }
        return {
            success: true,
            data: {
                assetId,
                secureUrl,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
        };
    }
    async getHls(assetId, userId) {
        return this.getSecureUrl(assetId, userId);
    }
    async assertAssetAccessible(userId, assetId) {
        const asset = await this.prisma.asset.findUnique({
            where: { id: assetId },
            select: { projectId: true },
        });
        if (!asset)
            throw new common_1.NotFoundException('Asset not found');
        const member = await this.prisma.projectMember.findFirst({
            where: {
                userId,
                projectId: asset.projectId,
            },
        });
        const project = await this.prisma.project.findUnique({
            where: { id: asset.projectId },
        });
        if (!member && project?.ownerId !== userId) {
            throw new common_1.ForbiddenException('Access denied to this asset');
        }
        return true;
    }
    async addWatermark(assetId, userId) {
        this.logger.warn(`Watermarking requested for ${assetId} but not implemented in MVP`);
        return {
            success: false,
            message: 'Watermarking not supported in MVP',
        };
    }
};
exports.AssetService = AssetService;
exports.AssetService = AssetService = AssetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], AssetService);
//# sourceMappingURL=asset.service.js.map