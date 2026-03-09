"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineAdminModule = void 0;
const common_1 = require("@nestjs/common");
const engine_admin_controller_1 = require("./engine-admin.controller");
const engine_admin_service_1 = require("./engine-admin.service");
const prisma_module_1 = require("../prisma/prisma.module");
const permission_module_1 = require("../permission/permission.module");
const auth_module_1 = require("../auth/auth.module");
let EngineAdminModule = class EngineAdminModule {
};
exports.EngineAdminModule = EngineAdminModule;
exports.EngineAdminModule = EngineAdminModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, permission_module_1.PermissionModule, auth_module_1.AuthModule],
        controllers: [engine_admin_controller_1.EngineAdminController],
        providers: [engine_admin_service_1.EngineAdminService],
        exports: [engine_admin_service_1.EngineAdminService],
    })
], EngineAdminModule);
//# sourceMappingURL=engine-admin.module.js.map