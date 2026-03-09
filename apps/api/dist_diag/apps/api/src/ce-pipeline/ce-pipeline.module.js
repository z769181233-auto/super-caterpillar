"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEPipelineModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const job_module_1 = require("../job/job.module");
const auth_module_1 = require("../auth/auth.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const permission_module_1 = require("../permission/permission.module");
const ce_dag_controller_1 = require("./ce-dag.controller");
const ce_dag_orchestrator_service_1 = require("./ce-dag-orchestrator.service");
let CEPipelineModule = class CEPipelineModule {
};
exports.CEPipelineModule = CEPipelineModule;
exports.CEPipelineModule = CEPipelineModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, job_module_1.JobModule, auth_module_1.AuthModule, api_security_module_1.ApiSecurityModule, permission_module_1.PermissionModule],
        controllers: [ce_dag_controller_1.CEDagController],
        providers: [ce_dag_orchestrator_service_1.CEDagOrchestratorService],
        exports: [ce_dag_orchestrator_service_1.CEDagOrchestratorService],
    })
], CEPipelineModule);
//# sourceMappingURL=ce-pipeline.module.js.map