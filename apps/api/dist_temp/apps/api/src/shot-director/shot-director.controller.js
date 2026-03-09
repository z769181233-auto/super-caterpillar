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
exports.ShotDirectorController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
const shot_director_service_1 = require("./shot-director.service");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let ShotDirectorController = class ShotDirectorController {
    shotDirectorService;
    constructor(shotDirectorService) {
        this.shotDirectorService = shotDirectorService;
    }
    async inpaint(shotId, user) {
        return this.shotDirectorService.inpaint(shotId, user?.id);
    }
    async pose(shotId, user) {
        return this.shotDirectorService.pose(shotId, user?.id);
    }
    async composeVideo(sceneId, user) {
        return this.shotDirectorService.composeVideo(sceneId, user?.id);
    }
};
exports.ShotDirectorController = ShotDirectorController;
__decorate([
    (0, common_1.Post)(':shotId/inpaint'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SHOT_INPAINT),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Param)('shotId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShotDirectorController.prototype, "inpaint", null);
__decorate([
    (0, common_1.Post)(':shotId/pose'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SHOT_POSE),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Param)('shotId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShotDirectorController.prototype, "pose", null);
__decorate([
    (0, common_1.Post)('scene/:sceneId/compose-video'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('sceneId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShotDirectorController.prototype, "composeVideo", null);
exports.ShotDirectorController = ShotDirectorController = __decorate([
    (0, common_1.Controller)('shots'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [shot_director_service_1.ShotDirectorService])
], ShotDirectorController);
//# sourceMappingURL=shot-director.controller.js.map