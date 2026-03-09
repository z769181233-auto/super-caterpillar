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
exports.EngineAdminController = void 0;
const common_1 = require("@nestjs/common");
const engine_admin_service_1 = require("./engine-admin.service");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const permission_constants_1 = require("../permission/permission.constants");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
let EngineAdminController = class EngineAdminController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list() {
        const data = await this.service.list();
        return { success: true, data };
    }
    async listPublic() {
        const data = await this.service.list();
        const publicData = data.map((engine) => ({
            engineKey: engine.engineKey,
            adapterName: engine.adapterName,
            adapterType: engine.adapterType,
            defaultVersion: engine.defaultVersion,
            versions: engine.versions?.map((v) => ({
                versionName: v.versionName,
                enabled: v.enabled,
            })) || [],
            enabled: engine.enabled,
        }));
        return { success: true, data: publicData };
    }
    async createOrReplace(body) {
        const engine = await this.service.createOrReplace(body);
        return { success: true, data: engine };
    }
    async update(key, body) {
        const engine = await this.service.update(key, body);
        return { success: true, data: engine };
    }
    async remove(key) {
        await this.service.delete(key);
        return { success: true };
    }
    async listVersions(key) {
        const data = await this.service.listVersions(key);
        return { success: true, data };
    }
    async createOrUpdateVersion(key, body) {
        const data = await this.service.createOrUpdateVersion(key, body);
        return { success: true, data };
    }
    async updateVersion(key, versionName, body) {
        const data = await this.service.updateVersion(key, versionName, body);
        return { success: true, data };
    }
    async deleteVersion(key, versionName) {
        await this.service.deleteVersion(key, versionName);
        return { success: true };
    }
    async updateDefaultVersion(key, body) {
        const data = await this.service.updateDefaultVersion(key, body.defaultVersion ?? null);
        return { success: true, data };
    }
};
exports.EngineAdminController = EngineAdminController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "listPublic", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "createOrReplace", null);
__decorate([
    (0, common_1.Patch)(':key'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':key'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':key/versions'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)(':key/versions'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "createOrUpdateVersion", null);
__decorate([
    (0, common_1.Patch)(':key/versions/:versionName'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Param)('versionName')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "updateVersion", null);
__decorate([
    (0, common_1.Delete)(':key/versions/:versionName'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Param)('versionName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "deleteVersion", null);
__decorate([
    (0, common_1.Patch)(':key/default-version'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EngineAdminController.prototype, "updateDefaultVersion", null);
exports.EngineAdminController = EngineAdminController = __decorate([
    (0, common_1.Controller)('admin/engines'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [engine_admin_service_1.EngineAdminService])
], EngineAdminController);
//# sourceMappingURL=engine-admin.controller.js.map