"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskModule = void 0;
const common_1 = require("@nestjs/common");
const task_service_1 = require("./task.service");
const engine_task_service_1 = require("./engine-task.service");
const task_graph_service_1 = require("./task-graph.service");
const task_graph_controller_1 = require("./task-graph.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const engine_module_1 = require("../engines/engine.module");
const quality_feedback_service_1 = require("../quality/quality-feedback.service");
const job_module_1 = require("../job/job.module");
const quality_module_1 = require("../quality/quality.module");
let TaskModule = class TaskModule {
};
exports.TaskModule = TaskModule;
exports.TaskModule = TaskModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            audit_log_module_1.AuditLogModule,
            engine_module_1.EngineModule,
            (0, common_1.forwardRef)(() => job_module_1.JobModule),
            quality_module_1.QualityModule,
        ],
        controllers: [task_graph_controller_1.TaskGraphController],
        providers: [task_service_1.TaskService, engine_task_service_1.EngineTaskService, task_graph_service_1.TaskGraphService, quality_feedback_service_1.QualityFeedbackService],
        exports: [task_service_1.TaskService, engine_task_service_1.EngineTaskService, task_graph_service_1.TaskGraphService],
    })
], TaskModule);
//# sourceMappingURL=task.module.js.map