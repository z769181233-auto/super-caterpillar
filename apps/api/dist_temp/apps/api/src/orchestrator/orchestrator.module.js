"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorModule = void 0;
const common_1 = require("@nestjs/common");
const orchestrator_controller_1 = require("./orchestrator.controller");
const orchestrator_monitor_controller_1 = require("./orchestrator-monitor.controller");
const orchestrator_service_1 = require("./orchestrator.service");
const prisma_module_1 = require("../prisma/prisma.module");
const worker_module_1 = require("../worker/worker.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const task_module_1 = require("../task/task.module");
const auth_module_1 = require("../auth/auth.module");
const job_module_1 = require("../job/job.module");
const engine_module_1 = require("../engines/engine.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const project_module_1 = require("../project/project.module");
const novel_import_module_1 = require("../novel-import/novel-import.module");
const publish_module_1 = require("../publish/publish.module");
const stage1_verification_hook_1 = require("./hooks/stage1-verification.hook");
const production_flow_hook_1 = require("./hooks/production-flow.hook");
const worker_alias_controller_1 = require("./worker-alias.controller");
let OrchestratorModule = class OrchestratorModule {
};
exports.OrchestratorModule = OrchestratorModule;
exports.OrchestratorModule = OrchestratorModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            audit_log_module_1.AuditLogModule,
            task_module_1.TaskModule,
            auth_module_1.AuthModule,
            job_module_1.JobModule,
            engine_module_1.EngineModule,
            api_security_module_1.ApiSecurityModule,
            (0, common_1.forwardRef)(() => project_module_1.ProjectModule),
            novel_import_module_1.NovelImportModule,
            publish_module_1.PublishModule,
            (0, common_1.forwardRef)(() => worker_module_1.WorkerModule),
        ],
        controllers: [orchestrator_controller_1.OrchestratorController, orchestrator_monitor_controller_1.OrchestratorMonitorController, worker_alias_controller_1.WorkerAliasController],
        providers: [orchestrator_service_1.OrchestratorService, stage1_verification_hook_1.Stage1VerificationHook, production_flow_hook_1.ProductionFlowHook],
        exports: [orchestrator_service_1.OrchestratorService],
    })
], OrchestratorModule);
//# sourceMappingURL=orchestrator.module.js.map