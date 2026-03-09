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
exports.MemoryController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
const memory_service_1 = require("./memory.service");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let MemoryController = class MemoryController {
    memoryService;
    constructor(memoryService) {
        this.memoryService = memoryService;
    }
    async getShortTermMemory(chapterId, user) {
        return this.memoryService.getShortTermMemory(chapterId, user?.id);
    }
    async getLongTermMemory(entityId, user) {
        return this.memoryService.getLongTermMemory(entityId, user?.id);
    }
    async updateMemory(body, user) {
        return this.memoryService.updateMemory(body, user?.id);
    }
};
exports.MemoryController = MemoryController;
__decorate([
    (0, common_1.Get)('short-term/:chapterId'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.MEMORY_ACCESS),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('chapterId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MemoryController.prototype, "getShortTermMemory", null);
__decorate([
    (0, common_1.Get)('long-term/:entityId'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.MEMORY_ACCESS),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('entityId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MemoryController.prototype, "getLongTermMemory", null);
__decorate([
    (0, common_1.Post)('update'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.MEMORY_UPDATE),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MemoryController.prototype, "updateMemory", null);
exports.MemoryController = MemoryController = __decorate([
    (0, common_1.Controller)('memory'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [memory_service_1.MemoryService])
], MemoryController);
//# sourceMappingURL=memory.controller.js.map