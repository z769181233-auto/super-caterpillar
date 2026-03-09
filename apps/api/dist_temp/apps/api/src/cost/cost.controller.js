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
exports.CostController = exports.InternalEventsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const cost_ledger_service_1 = require("./cost-ledger.service");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
class CostEventDto {
    userId;
    projectId;
    jobId;
    jobType;
    engineKey;
    attempt;
    costAmount;
    currency;
    billingUnit;
    quantity;
    metadata;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "jobId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "jobType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "engineKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CostEventDto.prototype, "attempt", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CostEventDto.prototype, "costAmount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CostEventDto.prototype, "billingUnit", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CostEventDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CostEventDto.prototype, "metadata", void 0);
let InternalEventsController = class InternalEventsController {
    costLedger;
    constructor(costLedger) {
        this.costLedger = costLedger;
    }
    hmacPing() {
        return {
            ok: true,
            ts: Date.now(),
            message: 'HMAC authentication successful',
        };
    }
    async recordCost(dto) {
        try {
            const result = await this.costLedger.recordFromEvent(dto);
            return { ok: true, deduplicated: result.deduped, amountDeducted: result.amountDeducted };
        }
        catch (e) {
            const msg = String(e?.message ?? e);
            if (msg.startsWith('BILLING_REJECTED_') || msg.startsWith('INVALID_')) {
                throw new common_1.BadRequestException({ code: 'BILLING_REJECTED', message: msg });
            }
            throw e;
        }
    }
};
exports.InternalEventsController = InternalEventsController;
__decorate([
    (0, common_1.Get)('hmac-ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], InternalEventsController.prototype, "hmacPing", null);
__decorate([
    (0, common_1.Post)('cost-ledger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CostEventDto]),
    __metadata("design:returntype", Promise)
], InternalEventsController.prototype, "recordCost", null);
exports.InternalEventsController = InternalEventsController = __decorate([
    (0, common_1.Controller)('internal/events'),
    (0, api_security_decorator_1.RequireSignature)(),
    __metadata("design:paramtypes", [cost_ledger_service_1.CostLedgerService])
], InternalEventsController);
let CostController = class CostController {
    costLedgerService;
    constructor(costLedgerService) {
        this.costLedgerService = costLedgerService;
    }
    async getProjectCosts(projectId) {
        return this.costLedgerService.getProjectCosts(projectId);
    }
    async getCostSummary(projectId) {
        return this.costLedgerService.getProjectCostSummary(projectId);
    }
    async getCostByJobType(projectId) {
        return this.costLedgerService.getCostByJobType(projectId);
    }
};
exports.CostController = CostController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CostController.prototype, "getProjectCosts", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CostController.prototype, "getCostSummary", null);
__decorate([
    (0, common_1.Get)('by-type'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CostController.prototype, "getCostByJobType", null);
exports.CostController = CostController = __decorate([
    (0, common_1.Controller)('projects/:projectId/costs'),
    __metadata("design:paramtypes", [cost_ledger_service_1.CostLedgerService])
], CostController);
//# sourceMappingURL=cost.controller.js.map