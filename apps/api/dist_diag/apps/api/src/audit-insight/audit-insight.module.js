"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInsightModule = void 0;
const common_1 = require("@nestjs/common");
const audit_insight_controller_1 = require("./audit-insight.controller");
const audit_insight_service_1 = require("./audit-insight.service");
const audit_novel_controller_1 = require("./audit-novel.controller");
const shot_director_module_1 = require("../shot-director/shot-director.module");
let AuditInsightModule = class AuditInsightModule {
};
exports.AuditInsightModule = AuditInsightModule;
exports.AuditInsightModule = AuditInsightModule = __decorate([
    (0, common_1.Module)({
        imports: [shot_director_module_1.ShotDirectorModule],
        controllers: [audit_insight_controller_1.AuditInsightController, audit_novel_controller_1.AuditNovelController],
        providers: [audit_insight_service_1.AuditInsightService],
    })
], AuditInsightModule);
//# sourceMappingURL=audit-insight.module.js.map