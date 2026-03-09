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
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("./permissions.decorator");
const permission_service_1 = require("../permission/permission.service");
let PermissionsGuard = class PermissionsGuard {
    reflector;
    permissionService;
    constructor(reflector, permissionService) {
        this.reflector = reflector;
        this.permissionService = permissionService;
    }
    async canActivate(context) {
        const required = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required || required.length === 0) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user || !user.userId) {
            throw new common_1.ForbiddenException('Authentication required (user identity missing)');
        }
        const projectId = request.params?.projectId ||
            request.params?.id ||
            request.body?.projectId ||
            request.query?.projectId ||
            undefined;
        const ok = await this.permissionService.hasPermissions({
            userId: user.userId,
            projectId,
            required,
        });
        if (!ok) {
            const sysPerms = await this.permissionService.getUserPermissions(user.userId);
            const projPerms = projectId
                ? await this.permissionService.getProjectPermissions(projectId, user.userId)
                : [];
            throw new common_1.ForbiddenException(`Permission denied. Required: [${required.join(', ')}]. Has: Sys=[${sysPerms.join(',')}], Proj=[${projPerms.join(',')}]`);
        }
        return true;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(core_1.Reflector)),
    __param(1, (0, common_1.Inject)(permission_service_1.PermissionService)),
    __metadata("design:paramtypes", [core_1.Reflector,
        permission_service_1.PermissionService])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map