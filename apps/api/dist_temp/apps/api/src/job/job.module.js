"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const job_controller_1 = require("./job.controller");
const job_generic_controller_1 = require("./job-generic.controller");
const job_service_1 = require("./job.service");
const job_report_facade_1 = require("./job-report.facade");
const job_engine_binding_service_1 = require("./job-engine-binding.service");
const prisma_module_1 = require("../prisma/prisma.module");
const project_module_1 = require("../project/project.module");
const publish_module_1 = require("../publish/publish.module");
const permission_module_1 = require("../permission/permission.module");
const task_module_1 = require("../task/task.module");
const auth_module_1 = require("../auth/auth.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const engine_hub_module_1 = require("../engine-hub/engine-hub.module");
const engine_module_1 = require("../engines/engine.module");
const quality_module_1 = require("../quality/quality.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const billing_module_1 = require("../billing/billing.module");
const copyright_module_1 = require("../copyright/copyright.module");
const capacity_gate_module_1 = require("../capacity/capacity-gate.module");
const job_watchdog_service_1 = require("./job-watchdog.service");
const job_watchdog_controller_1 = require("./job-watchdog.controller");
const text_safety_module_1 = require("../text-safety/text-safety.module");
const shot_director_module_1 = require("../shot-director/shot-director.module");
const cost_module_1 = require("../cost/cost.module");
const config_2 = require("@scu/config");
const job_auth_ops_service_1 = require("./job-auth-ops.service");
const job_creation_ops_service_1 = require("./job-creation-ops.service");
const job_update_ops_service_1 = require("./job-update-ops.service");
const JOB_WORKER_ENABLED = config_2.env.enableInternalJobWorker;
let JobModule = class JobModule {
};
exports.JobModule = JobModule;
exports.JobModule = JobModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            prisma_module_1.PrismaModule,
            permission_module_1.PermissionModule,
            (0, common_1.forwardRef)(() => task_module_1.TaskModule),
            auth_module_1.AuthModule,
            audit_log_module_1.AuditLogModule,
            engine_hub_module_1.EngineHubModule,
            engine_module_1.EngineModule,
            quality_module_1.QualityModule,
            api_security_module_1.ApiSecurityModule,
            billing_module_1.BillingModule,
            copyright_module_1.CopyrightModule,
            capacity_gate_module_1.CapacityGateModule,
            text_safety_module_1.TextSafetyModule,
            shot_director_module_1.ShotDirectorModule,
            cost_module_1.CostModule,
            publish_module_1.PublishModule,
            (0, common_1.forwardRef)(() => project_module_1.ProjectModule),
        ],
        controllers: [job_controller_1.JobController, job_generic_controller_1.JobGenericController, job_watchdog_controller_1.JobWatchdogController],
        providers: [
            job_service_1.JobService,
            job_report_facade_1.JobReportFacade,
            job_engine_binding_service_1.JobEngineBindingService,
            job_watchdog_service_1.JobWatchdogService,
            job_auth_ops_service_1.JobAuthOpsService,
            job_creation_ops_service_1.JobCreationOpsService,
            job_update_ops_service_1.JobUpdateOpsService,
        ],
        exports: [job_service_1.JobService, job_report_facade_1.JobReportFacade],
    })
], JobModule);
//# sourceMappingURL=job.module.js.map