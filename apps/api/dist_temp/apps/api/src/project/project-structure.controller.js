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
exports.ProjectStructureController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const project_structure_service_1 = require("./project-structure.service");
const crypto_1 = require("crypto");
let ProjectStructureController = class ProjectStructureController {
    projectStructureService;
    constructor(projectStructureService) {
        this.projectStructureService = projectStructureService;
    }
    async getProjectStructure(projectId, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const data = await this.projectStructureService.getProjectStructureTree(projectId, user.userId, organizationId);
        return {
            success: true,
            data,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.ProjectStructureController = ProjectStructureController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectStructureController.prototype, "getProjectStructure", null);
exports.ProjectStructureController = ProjectStructureController = __decorate([
    (0, common_1.Controller)('projects/:projectId/structure'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Inject)(project_structure_service_1.ProjectStructureService)),
    __metadata("design:paramtypes", [project_structure_service_1.ProjectStructureService])
], ProjectStructureController);
//# sourceMappingURL=project-structure.controller.js.map