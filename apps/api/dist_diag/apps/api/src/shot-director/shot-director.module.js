"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotDirectorModule = void 0;
const common_1 = require("@nestjs/common");
const shot_director_controller_1 = require("./shot-director.controller");
const shot_director_service_1 = require("./shot-director.service");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const auth_module_1 = require("../auth/auth.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const permission_module_1 = require("../permission/permission.module");
const director_solver_service_1 = require("./director-solver.service");
let ShotDirectorModule = class ShotDirectorModule {
};
exports.ShotDirectorModule = ShotDirectorModule;
exports.ShotDirectorModule = ShotDirectorModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_log_module_1.AuditLogModule, auth_module_1.AuthModule, api_security_module_1.ApiSecurityModule, permission_module_1.PermissionModule],
        controllers: [shot_director_controller_1.ShotDirectorController],
        providers: [shot_director_service_1.ShotDirectorService, director_solver_service_1.DirectorConstraintSolverService],
        exports: [shot_director_service_1.ShotDirectorService, director_solver_service_1.DirectorConstraintSolverService],
    })
], ShotDirectorModule);
//# sourceMappingURL=shot-director.module.js.map