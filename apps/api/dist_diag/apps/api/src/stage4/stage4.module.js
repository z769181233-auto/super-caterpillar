"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stage4Module = void 0;
const common_1 = require("@nestjs/common");
const stage4_controller_1 = require("./stage4.controller");
const stage4_service_1 = require("./stage4.service");
const prisma_module_1 = require("../prisma/prisma.module");
const engine_hub_module_1 = require("../engine-hub/engine-hub.module");
const project_module_1 = require("../project/project.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const auth_module_1 = require("../auth/auth.module");
const permission_module_1 = require("../permission/permission.module");
let Stage4Module = class Stage4Module {
};
exports.Stage4Module = Stage4Module;
exports.Stage4Module = Stage4Module = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            engine_hub_module_1.EngineHubModule,
            project_module_1.ProjectModule,
            audit_log_module_1.AuditLogModule,
            auth_module_1.AuthModule,
            permission_module_1.PermissionModule,
        ],
        controllers: [stage4_controller_1.Stage4Controller],
        providers: [stage4_service_1.Stage4Service],
    })
], Stage4Module);
//# sourceMappingURL=stage4.module.js.map