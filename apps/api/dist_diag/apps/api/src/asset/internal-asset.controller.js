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
exports.InternalAssetController = void 0;
const common_1 = require("@nestjs/common");
const api_security_guard_1 = require("../security/api-security/api-security.guard");
const signed_url_service_1 = require("../storage/signed-url.service");
let InternalAssetController = class InternalAssetController {
    signedUrlService;
    constructor(signedUrlService) {
        this.signedUrlService = signedUrlService;
    }
    getPublicUrl(key) {
        if (!key) {
            throw new common_1.BadRequestException('key is required');
        }
        const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
            key,
            tenantId: 'system-gate',
            userId: 'system-gate-user',
            expiresIn: 300,
        });
        return {
            url,
            expiresAt,
            storageKey: key,
        };
    }
};
exports.InternalAssetController = InternalAssetController;
__decorate([
    (0, common_1.Get)('by-storage-key'),
    __param(0, (0, common_1.Query)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InternalAssetController.prototype, "getPublicUrl", null);
exports.InternalAssetController = InternalAssetController = __decorate([
    (0, common_1.Controller)('_internal/assets'),
    (0, common_1.UseGuards)(api_security_guard_1.ApiSecurityGuard),
    __metadata("design:paramtypes", [signed_url_service_1.SignedUrlService])
], InternalAssetController);
//# sourceMappingURL=internal-asset.controller.js.map