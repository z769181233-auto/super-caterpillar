"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityModule = void 0;
const common_1 = require("@nestjs/common");
const quality_metrics_writer_1 = require("./quality-metrics.writer");
const quality_score_service_1 = require("./quality-score.service");
const quality_gate_controller_1 = require("./quality-gate.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const job_module_1 = require("../job/job.module");
const quality_backfill_sweeper_1 = require("./quality-backfill.sweeper");
const project_module_1 = require("../project/project.module");
const identity_module_1 = require("../identity/identity.module");
let QualityModule = class QualityModule {
};
exports.QualityModule = QualityModule;
exports.QualityModule = QualityModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, (0, common_1.forwardRef)(() => job_module_1.JobModule), (0, common_1.forwardRef)(() => identity_module_1.IdentityModule), (0, common_1.forwardRef)(() => project_module_1.ProjectModule)],
        controllers: [quality_gate_controller_1.QualityGateController],
        providers: [quality_metrics_writer_1.QualityMetricsWriter, quality_score_service_1.QualityScoreService, quality_backfill_sweeper_1.QualityBackfillSweeper],
        exports: [quality_metrics_writer_1.QualityMetricsWriter, quality_score_service_1.QualityScoreService, quality_backfill_sweeper_1.QualityBackfillSweeper],
    })
], QualityModule);
//# sourceMappingURL=quality.module.js.map