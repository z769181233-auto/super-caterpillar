"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const billing_settlement_service_1 = require("./billing-settlement.service");
const financial_settlement_service_1 = require("./financial-settlement.service");
const billing_service_1 = require("./billing.service");
const budget_service_1 = require("./budget.service");
const billing_controller_1 = require("./billing.controller");
const prisma_module_1 = require("../prisma/prisma.module");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_log_module_1.AuditLogModule],
        controllers: [billing_controller_1.BillingController],
        providers: [billing_service_1.BillingService, budget_service_1.BudgetService, billing_settlement_service_1.BillingSettlementService, financial_settlement_service_1.FinancialSettlementService],
        exports: [billing_service_1.BillingService, budget_service_1.BudgetService, billing_settlement_service_1.BillingSettlementService, financial_settlement_service_1.FinancialSettlementService],
    })
], BillingModule);
//# sourceMappingURL=billing.module.js.map