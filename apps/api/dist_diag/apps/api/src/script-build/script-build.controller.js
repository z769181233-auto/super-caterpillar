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
exports.ShotsController = exports.ScriptBuildController = void 0;
const common_1 = require("@nestjs/common");
const script_build_service_1 = require("./script-build.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let ScriptBuildController = class ScriptBuildController {
    scriptBuildService;
    constructor(scriptBuildService) {
        this.scriptBuildService = scriptBuildService;
    }
    async getOutline(id) {
        console.log(`[ScriptBuildController] getOutline called for id: ${id}`);
        try {
            return await this.scriptBuildService.getOutline(id);
        }
        catch (e) {
            console.error(`[ScriptBuildController] getOutline error:`, e);
            throw e;
        }
    }
};
exports.ScriptBuildController = ScriptBuildController;
__decorate([
    (0, common_1.Get)(':id/outline'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScriptBuildController.prototype, "getOutline", null);
exports.ScriptBuildController = ScriptBuildController = __decorate([
    (0, common_1.Controller)('builds'),
    __metadata("design:paramtypes", [script_build_service_1.ScriptBuildService])
], ScriptBuildController);
let ShotsController = class ShotsController {
    scriptBuildService;
    constructor(scriptBuildService) {
        this.scriptBuildService = scriptBuildService;
    }
    async getSource(id, context) {
        console.log(`[ShotsController] getSource called for id: ${id}`);
        const contextSize = context ? parseInt(context, 10) : 400;
        try {
            return await this.scriptBuildService.getShotSource(id, contextSize);
        }
        catch (e) {
            console.error(`[ShotsController] getSource error:`, e);
            throw e;
        }
    }
};
exports.ShotsController = ShotsController;
__decorate([
    (0, common_1.Get)(':id/source'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('context')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ShotsController.prototype, "getSource", null);
exports.ShotsController = ShotsController = __decorate([
    (0, common_1.Controller)('shots'),
    __metadata("design:paramtypes", [script_build_service_1.ScriptBuildService])
], ShotsController);
//# sourceMappingURL=script-build.controller.js.map