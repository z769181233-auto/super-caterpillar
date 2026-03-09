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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetPublicDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
class AssetPublicDto {
    id;
    type;
    status;
    storageKey;
    signedUrl;
    signedUrlExpiresAt;
    static async fromAsset(asset, featureFlagService, signedUrlService, context) {
        const dto = new AssetPublicDto();
        dto.id = asset.id;
        dto.type = asset.type;
        dto.status = asset.status;
        dto.storageKey = asset.storageKey;
        if (featureFlagService.isEnabled('FEATURE_SIGNED_URL_ENFORCED')) {
            if (asset.type === 'VIDEO' && asset.status === 'GENERATED') {
                try {
                    const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '10', 10);
                    const { url, expiresAt } = await signedUrlService.generate(asset.storageKey, context.tenantId, context.userId, ttlMinutes);
                    dto.signedUrl = url;
                    dto.signedUrlExpiresAt = expiresAt.toISOString();
                }
                catch (error) {
                    new common_1.Logger('AssetPublicDto').error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        return dto;
    }
}
exports.AssetPublicDto = AssetPublicDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '向后兼容字段（至少保留到 Stage 12）' }),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "storageKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '签名 URL（需 Feature Flag）' }),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "signedUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '签名 URL 过期时间（ISO 8601）' }),
    __metadata("design:type", String)
], AssetPublicDto.prototype, "signedUrlExpiresAt", void 0);
//# sourceMappingURL=asset-public.dto.js.map