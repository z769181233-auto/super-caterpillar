"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelImportModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
const text_safety_module_1 = require("../text-safety/text-safety.module");
const novel_import_controller_1 = require("./novel-import.controller");
const novel_import_service_1 = require("./novel-import.service");
const file_parser_service_1 = require("./file-parser.service");
const novel_analysis_processor_service_1 = require("./novel-analysis-processor.service");
const novel_analysis_engine_service_1 = require("./novel-analysis-engine.service");
const novel_structure_generator_service_1 = require("./novel-structure-generator.service");
const novel_analysis_job_processor_service_1 = require("./novel-analysis-job-processor.service");
const prisma_module_1 = require("../prisma/prisma.module");
const project_module_1 = require("../project/project.module");
const task_module_1 = require("../task/task.module");
const job_module_1 = require("../job/job.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const audit_module_1 = require("../audit/audit.module");
const permission_module_1 = require("../permission/permission.module");
const orchestrator_module_1 = require("../orchestrator/orchestrator.module");
let NovelImportModule = class NovelImportModule {
};
exports.NovelImportModule = NovelImportModule;
exports.NovelImportModule = NovelImportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            (0, common_1.forwardRef)(() => project_module_1.ProjectModule),
            (0, common_1.forwardRef)(() => task_module_1.TaskModule),
            (0, common_1.forwardRef)(() => job_module_1.JobModule),
            audit_log_module_1.AuditLogModule,
            audit_module_1.AuditModule,
            permission_module_1.PermissionModule,
            (0, common_1.forwardRef)(() => orchestrator_module_1.OrchestratorModule),
            api_security_module_1.ApiSecurityModule,
            auth_module_1.AuthModule,
            text_safety_module_1.TextSafetyModule,
        ],
        controllers: [novel_import_controller_1.NovelImportController],
        providers: [
            novel_import_service_1.NovelImportService,
            file_parser_service_1.FileParserService,
            novel_analysis_processor_service_1.NovelAnalysisProcessorService,
            novel_analysis_engine_service_1.NovelAnalysisEngineService,
            novel_structure_generator_service_1.NovelStructureGeneratorService,
            novel_analysis_job_processor_service_1.NovelAnalysisJobProcessorService,
        ],
        exports: [
            novel_import_service_1.NovelImportService,
            file_parser_service_1.FileParserService,
            novel_analysis_processor_service_1.NovelAnalysisProcessorService,
            novel_analysis_engine_service_1.NovelAnalysisEngineService,
        ],
    })
], NovelImportModule);
//# sourceMappingURL=novel-import.module.js.map