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
exports.IdentityController = void 0;
const common_1 = require("@nestjs/common");
const api_security_guard_1 = require("../security/api-security/api-security.guard");
const identity_consistency_service_1 = require("./identity-consistency.service");
let IdentityController = class IdentityController {
    identityService;
    constructor(identityService) {
        this.identityService = identityService;
    }
    async scoreAndRecord(body) {
        const { projectId, characterId, referenceAssetId, targetAssetId, shotId, referenceAnchorId } = body;
        const result = await this.identityService.scoreIdentity(referenceAssetId, targetAssetId, characterId, shotId);
        try {
            const record = await this.identityService.recordScore(shotId, characterId, referenceAnchorId, targetAssetId, result);
            return {
                ...result,
                recordId: record.id,
            };
        }
        catch (e) {
            console.error('Failed to record score', e);
            throw new common_1.InternalServerErrorException('Failed to record identity score');
        }
    }
};
exports.IdentityController = IdentityController;
__decorate([
    (0, common_1.Post)('score-and-record'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "scoreAndRecord", null);
exports.IdentityController = IdentityController = __decorate([
    (0, common_1.Controller)('_internal/ce23'),
    (0, common_1.UseGuards)(api_security_guard_1.ApiSecurityGuard),
    __metadata("design:paramtypes", [identity_consistency_service_1.IdentityConsistencyService])
], IdentityController);
//# sourceMappingURL=identity.controller.js.map