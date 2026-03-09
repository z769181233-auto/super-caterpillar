"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerModule = void 0;
const common_1 = require("@nestjs/common");
const worker_controller_1 = require("./worker.controller");
const worker_monitor_controller_1 = require("./worker-monitor.controller");
const worker_service_1 = require("./worker.service");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const auth_module_1 = require("../auth/auth.module");
const job_module_1 = require("../job/job.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
let WorkerModule = class WorkerModule {
};
exports.WorkerModule = WorkerModule;
exports.WorkerModule = WorkerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            audit_log_module_1.AuditLogModule,
            auth_module_1.AuthModule,
            job_module_1.JobModule,
            api_security_module_1.ApiSecurityModule,
        ],
        controllers: [worker_controller_1.WorkerController, worker_monitor_controller_1.WorkerMonitorController],
        providers: [worker_service_1.WorkerService],
        exports: [worker_service_1.WorkerService],
    })
], WorkerModule);
//# sourceMappingURL=worker.module.js.map