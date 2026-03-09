"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextModule = void 0;
const common_1 = require("@nestjs/common");
const text_controller_1 = require("./text.controller");
const text_service_1 = require("./text.service");
const text_safety_service_1 = require("./text-safety.service");
const job_module_1 = require("../job/job.module");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const quality_module_1 = require("../quality/quality.module");
const permission_module_1 = require("../permission/permission.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const auth_module_1 = require("../auth/auth.module");
let TextModule = class TextModule {
};
exports.TextModule = TextModule;
exports.TextModule = TextModule = __decorate([
    (0, common_1.Module)({
        imports: [
            job_module_1.JobModule,
            prisma_module_1.PrismaModule,
            audit_log_module_1.AuditLogModule,
            quality_module_1.QualityModule,
            permission_module_1.PermissionModule,
            api_security_module_1.ApiSecurityModule,
            auth_module_1.AuthModule,
        ],
        controllers: [text_controller_1.TextController],
        providers: [text_service_1.TextService, text_safety_service_1.TextSafetyService],
        exports: [text_service_1.TextService, text_safety_service_1.TextSafetyService],
    })
], TextModule);
//# sourceMappingURL=text.module.js.map