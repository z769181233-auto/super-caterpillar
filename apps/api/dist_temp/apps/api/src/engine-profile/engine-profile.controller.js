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
exports.EngineProfileController = void 0;
const common_1 = require("@nestjs/common");
const engine_profile_service_1 = require("./engine-profile.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const crypto_1 = require("crypto");
let EngineProfileController = class EngineProfileController {
    engineProfileService;
    constructor(engineProfileService) {
        this.engineProfileService = engineProfileService;
    }
    async getSummary(engineKey, projectId, from, to) {
        const query = {
            engineKey: engineKey || undefined,
            projectId: projectId || undefined,
            from: from || undefined,
            to: to || undefined,
        };
        const data = await this.engineProfileService.getProfileSummary(query);
        return {
            success: true,
            data,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.EngineProfileController = EngineProfileController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('engineKey')),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], EngineProfileController.prototype, "getSummary", null);
exports.EngineProfileController = EngineProfileController = __decorate([
    (0, common_1.Controller)('engine-profile'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [engine_profile_service_1.EngineProfileService])
], EngineProfileController);
//# sourceMappingURL=engine-profile.controller.js.map