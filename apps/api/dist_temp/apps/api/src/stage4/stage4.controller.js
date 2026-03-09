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
exports.Stage4Controller = void 0;
const common_1 = require("@nestjs/common");
const stage4_service_1 = require("./stage4.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const permission_constants_1 = require("../permission/permission.constants");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
let Stage4Controller = class Stage4Controller {
    stage4Service;
    constructor(stage4Service) {
        this.stage4Service = stage4Service;
    }
    async runSemanticEnhancement(projectId, sceneId, user, organizationId) {
        const data = await this.stage4Service.runSemanticEnhancement(projectId, sceneId, user.userId);
        await this.stage4Service.recordAudit('SEMANTIC_ENHANCEMENT_RUN', 'scene', sceneId, user.userId, { projectId, organizationId });
        return { success: true, data };
    }
    async getSemanticEnhancement(projectId, sceneId) {
        const record = await this.stage4Service.getSemanticEnhancement(sceneId);
        return { success: true, data: record?.data || null };
    }
    async runShotPlanning(projectId, shotId, user, organizationId) {
        const data = await this.stage4Service.runShotPlanning(projectId, shotId, user.userId);
        await this.stage4Service.recordAudit('SHOT_PLANNING_RUN', 'shot', shotId, user.userId, {
            projectId,
            organizationId,
        });
        return { success: true, data };
    }
    async getShotPlanning(projectId, shotId) {
        const record = await this.stage4Service.getShotPlanning(shotId);
        return { success: true, data: record?.data || null };
    }
    async runStructureQA(projectId, user, organizationId) {
        const data = await this.stage4Service.runStructureQA(projectId, user.userId);
        await this.stage4Service.recordAudit('STRUCTURE_QA_RUN', 'project', projectId, user.userId, {
            organizationId,
        });
        return { success: true, data };
    }
    async getStructureQA(projectId) {
        const record = await this.stage4Service.getStructureQA(projectId);
        return { success: true, data: record?.data || null };
    }
};
exports.Stage4Controller = Stage4Controller;
__decorate([
    (0, common_1.Post)('projects/:projectId/scenes/:sceneId/semantic-enhancement'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_GENERATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('sceneId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "runSemanticEnhancement", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/scenes/:sceneId/semantic-enhancement'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('sceneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "getSemanticEnhancement", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/shots/:shotId/shot-planning'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_GENERATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('shotId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "runShotPlanning", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/shots/:shotId/shot-planning'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('shotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "getShotPlanning", null);
__decorate([
    (0, common_1.Post)('structure-quality/assess'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_GENERATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "runStructureQA", null);
__decorate([
    (0, common_1.Get)('structure-quality/report'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Stage4Controller.prototype, "getStructureQA", null);
exports.Stage4Controller = Stage4Controller = __decorate([
    (0, common_1.Controller)('stage4'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [stage4_service_1.Stage4Service])
], Stage4Controller);
//# sourceMappingURL=stage4.controller.js.map