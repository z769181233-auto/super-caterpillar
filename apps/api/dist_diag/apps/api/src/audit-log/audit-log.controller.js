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
var AuditLogController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("./audit-log.service");
const hmac_auth_guard_1 = require("../auth/hmac/hmac-auth.guard");
let AuditLogController = AuditLogController_1 = class AuditLogController {
    auditLogService;
    logger = new common_1.Logger(AuditLogController_1.name);
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
    }
    async createAuditLog(payload) {
        try {
            const details = {
                traceId: payload.traceId,
                projectId: payload.projectId,
                jobId: payload.jobId,
                jobType: payload.jobType,
                engineKey: payload.engineKey,
                status: payload.status,
                inputHash: payload.inputHash,
                outputHash: payload.outputHash,
                latencyMs: payload.latencyMs,
                cost: payload.cost,
                auditTrail: payload.auditTrail,
                errorMessage: payload.errorMessage,
            };
            await this.auditLogService.record({
                action: `CE_${payload.engineKey.toUpperCase()}_${payload.status}`,
                resourceType: 'job',
                resourceId: payload.jobId,
                details,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Failed to create audit log: ${error instanceof Error ? error.message : String(error)}`);
            return { success: false };
        }
    }
};
exports.AuditLogController = AuditLogController;
__decorate([
    (0, common_1.Post)('logs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuditLogController.prototype, "createAuditLog", null);
exports.AuditLogController = AuditLogController = AuditLogController_1 = __decorate([
    (0, common_1.Controller)('audit'),
    (0, common_1.UseGuards)(hmac_auth_guard_1.HmacAuthGuard),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], AuditLogController);
//# sourceMappingURL=audit-log.controller.js.map