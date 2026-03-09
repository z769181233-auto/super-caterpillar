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
var CostLedgerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostLedgerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const billing_service_1 = require("../billing/billing.service");
const ALLOWED_BILLING_UNITS = new Set([
    'job',
    'tokens',
    'seconds',
    'frames',
    'gpu_seconds',
    'cpu_seconds',
]);
let CostLedgerService = CostLedgerService_1 = class CostLedgerService {
    prisma;
    billingService;
    logger = new common_1.Logger(CostLedgerService_1.name);
    constructor(prisma, billingService) {
        this.prisma = prisma;
        this.billingService = billingService;
    }
    async recordFromEvent(e) {
        if (!ALLOWED_BILLING_UNITS.has(e.billingUnit)) {
            throw new Error(`INVALID_BILLING_UNIT=${e.billingUnit}`);
        }
        if (!Number.isFinite(e.costAmount) || e.costAmount < 0) {
            throw new Error(`INVALID_COST_AMOUNT=${e.costAmount}`);
        }
        const attemptNum = e.attempt ?? 0;
        const job = await this.prisma.shotJob.findUnique({
            where: { id: e.jobId },
            select: {
                id: true,
                status: true,
                attempts: true,
                type: true,
                organizationId: true,
                traceId: true,
            },
        });
        if (!job) {
            throw new Error(`BILLING_REJECTED_JOB_NOT_FOUND jobId=${e.jobId}`);
        }
        if (job.status !== 'SUCCEEDED' && job.status !== 'RUNNING') {
            throw new Error(`BILLING_REJECTED_JOB_NOT_SUCCEEDED status=${job.status} jobId=${e.jobId}`);
        }
        await this.billingService.consumeCredits(e.projectId, e.userId, job.organizationId || 'missing', e.costAmount, `BILLING_V3:${e.jobType}`, e.jobId);
        return { deduped: false, amountDeducted: e.costAmount };
    }
    async getProjectCosts(projectId) {
        return this.prisma.billingLedger.findMany({
            where: { projectId: projectId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getProjectCostSummary(projectId) {
        const rows = await this.prisma.billingLedger.findMany({
            where: { projectId: projectId },
        });
        const total = rows.reduce((s, r) => s + Number(r.amount) / 100, 0);
        return {
            projectId,
            total,
            currency: 'CREDIT',
            itemCount: rows.length,
        };
    }
    async getCostByJobType(projectId) {
        const costs = await this.getProjectCosts(projectId);
        const byType = costs.reduce((acc, cost) => {
            const type = cost.billingState || 'UNKNOWN';
            if (!acc[type]) {
                acc[type] = { count: 0, total: 0 };
            }
            acc[type].count++;
            acc[type].total += Number(cost.amount) / 100;
            return acc;
        }, {});
        return byType;
    }
};
exports.CostLedgerService = CostLedgerService;
exports.CostLedgerService = CostLedgerService = CostLedgerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_service_1.BillingService])
], CostLedgerService);
//# sourceMappingURL=cost-ledger.service.js.map