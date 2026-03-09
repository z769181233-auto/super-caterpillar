"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const admin_controller_1 = require("./admin.controller");
const prod_gate_controller_1 = require("./prod-gate.controller");
const monitoring_controller_1 = require("./monitoring.controller");
const monitoring_service_1 = require("./monitoring.service");
const prisma_module_1 = require("../prisma/prisma.module");
const worker_module_1 = require("../worker/worker.module");
const engine_module_1 = require("../engines/engine.module");
const orchestrator_module_1 = require("../orchestrator/orchestrator.module");
const job_module_1 = require("../job/job.module");
const auth_module_1 = require("../auth/auth.module");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, worker_module_1.WorkerModule, engine_module_1.EngineModule, orchestrator_module_1.OrchestratorModule, job_module_1.JobModule, auth_module_1.AuthModule],
        controllers: [admin_controller_1.AdminController, prod_gate_controller_1.ProdGateController, monitoring_controller_1.MonitoringController, monitoring_controller_1.PublicMetricsController],
        providers: [monitoring_service_1.MonitoringService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map