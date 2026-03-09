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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MonitoringService = class MonitoringService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getP1Metrics() {
        const counts = await this.prisma.shotJob.groupBy({
            by: ['status'],
            _count: true,
        });
        const metricsMap = counts.reduce((acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
        }, {});
        const terminalStates = ['SUCCEEDED', 'FAILED', 'CANCELED', 'CANCELLED'];
        const total = Object.values(metricsMap).reduce((a, b) => a + b, 0);
        const succeeded = metricsMap['SUCCEEDED'] || 0;
        const failed = metricsMap['FAILED'] || 0;
        const pending = total -
            Object.entries(metricsMap).reduce((sum, [status, count]) => {
                return terminalStates.includes(status) ? sum + count : sum;
            }, 0);
        const ledgerDups = await this.prisma.$queryRaw `
      SELECT "jobId", "attempt", COUNT(*) as count
      FROM "cost_ledgers"
      GROUP BY "jobId", "attempt"
      HAVING COUNT(*) > 1
    `;
        const p95LatencyResult = await this.prisma.$queryRaw `
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY (EXTRACT(EPOCH FROM "updatedAt") - EXTRACT(EPOCH FROM "createdAt")) * 1000) as p95
      FROM "shot_jobs"
      WHERE "status" IN ('SUCCEEDED', 'FAILED')
        AND "updatedAt" > NOW() - INTERVAL '24 hours'
    `;
        const latency_p95_ms = Math.round(p95LatencyResult[0]?.p95 || 0);
        return {
            timestamp: Date.now(),
            metrics: {
                jobs_total: total,
                jobs_pending: pending,
                jobs_succeeded: succeeded,
                jobs_failed: failed,
                ledger_dups: ledgerDups.length,
                latency_p95_ms,
                window: '24h',
            },
        };
    }
};
exports.MonitoringService = MonitoringService;
exports.MonitoringService = MonitoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MonitoringService);
//# sourceMappingURL=monitoring.service.js.map