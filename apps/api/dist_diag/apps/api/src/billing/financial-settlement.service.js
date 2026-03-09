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
var FinancialSettlementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialSettlementService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let FinancialSettlementService = FinancialSettlementService_1 = class FinancialSettlementService {
    prisma;
    logger = new common_1.Logger(FinancialSettlementService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async writeBillingLedger(entry) {
        this.logger.debug(`[FinancialSettlement] Ignored obsolete legacy ledger write for ${entry.traceId}`);
    }
    calculateCE06Cost(charCount) {
        if (!charCount || charCount <= 0)
            return 0;
        return Math.ceil(charCount / 10000);
    }
    calculateShotRenderCost() {
        return 1;
    }
    calculateVideoRenderCost() {
        return 10;
    }
};
exports.FinancialSettlementService = FinancialSettlementService;
exports.FinancialSettlementService = FinancialSettlementService = FinancialSettlementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinancialSettlementService);
//# sourceMappingURL=financial-settlement.service.js.map