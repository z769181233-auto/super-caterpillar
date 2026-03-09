"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const billing_module_1 = require("../billing/billing.module");
const cost_ledger_service_1 = require("./cost-ledger.service");
const cost_limit_service_1 = require("./cost-limit.service");
const cost_controller_1 = require("./cost.controller");
let CostModule = class CostModule {
};
exports.CostModule = CostModule;
exports.CostModule = CostModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, billing_module_1.BillingModule],
        controllers: [cost_controller_1.CostController, cost_controller_1.InternalEventsController],
        providers: [cost_ledger_service_1.CostLedgerService, cost_limit_service_1.CostLimitService],
        exports: [cost_ledger_service_1.CostLedgerService, cost_limit_service_1.CostLimitService],
    })
], CostModule);
//# sourceMappingURL=cost.module.js.map