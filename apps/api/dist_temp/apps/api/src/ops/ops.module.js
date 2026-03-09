"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsModule = void 0;
const common_1 = require("@nestjs/common");
const ops_controller_1 = require("./ops.controller");
const ops_metrics_service_1 = require("./ops-metrics.service");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const permission_module_1 = require("../permission/permission.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
let OpsModule = class OpsModule {
};
exports.OpsModule = OpsModule;
exports.OpsModule = OpsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule, permission_module_1.PermissionModule, api_security_module_1.ApiSecurityModule],
        controllers: [ops_controller_1.OpsController],
        providers: [ops_metrics_service_1.OpsMetricsService],
        exports: [ops_metrics_service_1.OpsMetricsService],
    })
], OpsModule);
//# sourceMappingURL=ops.module.js.map