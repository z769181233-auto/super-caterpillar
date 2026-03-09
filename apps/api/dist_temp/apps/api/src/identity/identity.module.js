"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityModule = void 0;
const common_1 = require("@nestjs/common");
const identity_consistency_service_1 = require("./identity-consistency.service");
const identity_controller_1 = require("./identity.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const project_module_1 = require("../project/project.module");
let IdentityModule = class IdentityModule {
};
exports.IdentityModule = IdentityModule;
exports.IdentityModule = IdentityModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, api_security_module_1.ApiSecurityModule, (0, common_1.forwardRef)(() => project_module_1.ProjectModule)],
        controllers: [identity_controller_1.IdentityController],
        providers: [identity_consistency_service_1.IdentityConsistencyService],
        exports: [identity_consistency_service_1.IdentityConsistencyService],
    })
], IdentityModule);
//# sourceMappingURL=identity.module.js.map