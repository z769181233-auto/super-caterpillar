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
var BudgetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetService = exports.BudgetLevel = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
var BudgetLevel;
(function (BudgetLevel) {
    BudgetLevel["OK"] = "OK";
    BudgetLevel["WARN"] = "WARN";
    BudgetLevel["BLOCK_HIGH_COST"] = "BLOCK_HIGH_COST";
    BudgetLevel["BLOCK_ALL_CONSUME"] = "BLOCK_ALL_CONSUME";
})(BudgetLevel || (exports.BudgetLevel = BudgetLevel = {}));
let BudgetService = BudgetService_1 = class BudgetService {
    prisma;
    logger = new common_1.Logger(BudgetService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBudgetStatus(organizationId, projectId) {
        const startTime = Date.now();
        this.logger.log(`BUDGET_IN orgId=${organizationId}`);
        try {
            const costCenter = await this.prisma.costCenter.findFirst({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
            });
            if (!costCenter) {
                const costMs = Date.now() - startTime;
                this.logger.log(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} result=NO_COST_CENTER`);
                return { ratio: 0, level: BudgetLevel.OK };
            }
            const ratio = costCenter.budget > 0 ? costCenter.currentCost / costCenter.budget : 0;
            let level;
            if (ratio >= 1.2)
                level = BudgetLevel.BLOCK_ALL_CONSUME;
            else if (ratio >= 1.0)
                level = BudgetLevel.BLOCK_HIGH_COST;
            else if (ratio >= 0.8)
                level = BudgetLevel.WARN;
            else
                level = BudgetLevel.OK;
            const costMs = Date.now() - startTime;
            if (costMs > 2000) {
                this.logger.warn(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} SLOW_QUERY ratio=${ratio.toFixed(2)} level=${level}`);
            }
            else {
                this.logger.log(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} ratio=${ratio.toFixed(2)} level=${level}`);
            }
            return { ratio, level };
        }
        catch (error) {
            const costMs = Date.now() - startTime;
            this.logger.error(`BUDGET_ERR orgId=${organizationId} costMs=${costMs} error=${error?.message}`);
            throw error;
        }
    }
};
exports.BudgetService = BudgetService;
exports.BudgetService = BudgetService = BudgetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BudgetService);
//# sourceMappingURL=budget.service.js.map