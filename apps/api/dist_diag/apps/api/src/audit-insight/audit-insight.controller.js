"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInsightController = void 0;
const common_1 = require("@nestjs/common");
const audit_insight_service_1 = require("./audit-insight.service");
let AuditInsightController = class AuditInsightController {
    auditInsightService;
    constructor(auditInsightService) {
        this.auditInsightService = auditInsightService;
    }
    async getNovelInsight(novelSourceId) {
        return this.auditInsightService.getNovelInsight(novelSourceId);
    }
    async getJobAudit(jobId) {
        return this.auditInsightService.getJobAudit(jobId);
    }
};
exports.AuditInsightController = AuditInsightController;
__decorate([
    (0, common_1.Get)('novels/:novelSourceId/insight'),
    __param(0, (0, common_1.Param)('novelSourceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditInsightController.prototype, "getNovelInsight", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditInsightController.prototype, "getJobAudit", null);
exports.AuditInsightController = AuditInsightController = __decorate([
    (0, common_1.Controller)('audit-insight'),
    __metadata("design:paramtypes", [audit_insight_service_1.AuditInsightService])
], AuditInsightController);
//# sourceMappingURL=audit-insight.controller.js.map