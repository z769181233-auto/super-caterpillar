"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModule = void 0;
const common_1 = require("@nestjs/common");
const project_controller_1 = require("./project.controller");
const project_structure_controller_1 = require("./project-structure.controller");
const project_service_1 = require("./project.service");
const project_structure_service_1 = require("./project-structure.service");
const structure_generate_service_1 = require("./structure-generate.service");
const scene_graph_service_1 = require("./scene-graph.service");
const scene_graph_cache_1 = require("./scene-graph.cache");
const user_module_1 = require("../user/user.module");
const prisma_module_1 = require("../prisma/prisma.module");
const permission_module_1 = require("../permission/permission.module");
const job_module_1 = require("../job/job.module");
const task_module_1 = require("../task/task.module");
const auth_module_1 = require("../auth/auth.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const audit_module_1 = require("../audit/audit.module");
const redis_module_1 = require("../redis/redis.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const project_resolver_1 = require("../common/project-resolver");
let ProjectModule = class ProjectModule {
};
exports.ProjectModule = ProjectModule;
exports.ProjectModule = ProjectModule = __decorate([
    (0, common_1.Module)({
        imports: [
            user_module_1.UserModule,
            prisma_module_1.PrismaModule,
            (0, common_1.forwardRef)(() => job_module_1.JobModule),
            permission_module_1.PermissionModule,
            (0, common_1.forwardRef)(() => task_module_1.TaskModule),
            auth_module_1.AuthModule,
            audit_log_module_1.AuditLogModule,
            audit_module_1.AuditModule,
            redis_module_1.RedisModule,
            api_security_module_1.ApiSecurityModule,
        ],
        controllers: [project_controller_1.ProjectController, project_structure_controller_1.ProjectStructureController],
        providers: [
            project_service_1.ProjectService,
            project_structure_service_1.ProjectStructureService,
            structure_generate_service_1.StructureGenerateService,
            scene_graph_service_1.SceneGraphService,
            scene_graph_cache_1.SceneGraphCache,
            project_resolver_1.ProjectResolver,
        ],
        exports: [
            project_service_1.ProjectService,
            project_structure_service_1.ProjectStructureService,
            structure_generate_service_1.StructureGenerateService,
            scene_graph_service_1.SceneGraphService,
            project_resolver_1.ProjectResolver,
        ],
    })
], ProjectModule);
//# sourceMappingURL=project.module.js.map