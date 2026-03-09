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
var BillingSettlementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingSettlementService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const crypto_1 = require("crypto");
let BillingSettlementService = BillingSettlementService_1 = class BillingSettlementService {
    prisma;
    auditLogService;
    logger = new common_1.Logger(BillingSettlementService_1.name);
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async settleProject(projectId, runId = 'batch-' + Date.now()) {
        const startTime = Date.now();
        this.logger.log(`[P1-C] Starting settlement for project: ${projectId} (runId: ${runId})`);
        await this.recordAudit(null, projectId, 'billing.settle.start', { runId }, runId);
        const ledgers = await this.prisma.billingLedger.findMany({
            where: {
                projectId: projectId,
                billingState: 'COMMITTED',
            },
            orderBy: { createdAt: 'asc' },
        });
        if (ledgers.length === 0) {
            this.logger.log(`[P1-C] No pending ledgers for project ${projectId}`);
            return { processedCount: 0, failedCount: 0 };
        }
        this.logger.log(`[P1-C] Processing ${ledgers.length} items...`);
        let processedCount = 0;
        let failedCount = 0;
        for (const l of ledgers) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    const ledger = await tx.billingLedger.findUnique({ where: { id: l.id } });
                    if (ledger?.billingState !== 'COMMITTED') {
                        return;
                    }
                    if (!l.projectId)
                        throw new Error('MISSING_PROJECT_ID');
                    const costToCharge = Number(l.amount) / 100;
                    const proj = await tx.project.findUnique({ where: { id: l.projectId } });
                    const orgId = proj?.organizationId || l.projectId;
                    await tx.$executeRaw `SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
                    const org = await tx.organization.findUnique({ where: { id: orgId } });
                    if (!org)
                        throw new Error('ORG_NOT_FOUND');
                    if (org.credits < costToCharge) {
                        throw new Error('INSUFFICIENT_CREDITS');
                    }
                    const eventId = (0, crypto_1.randomUUID)();
                    await tx.billingEvent.create({
                        data: {
                            id: eventId,
                            projectId: l.projectId,
                            orgId: orgId,
                            userId: undefined,
                            type: 'CONSUME',
                            creditsDelta: -costToCharge,
                            metadata: {
                                ledgerId: l.id,
                                itemId: l.jobId,
                                traceId: l.jobId,
                                settleRunId: runId,
                            },
                        },
                    });
                    await tx.organization.update({
                        where: { id: orgId },
                        data: { credits: { decrement: costToCharge } },
                    });
                    processedCount++;
                    await this.recordAudit(null, l.projectId, 'billing.settle.item.billed', {
                        ledgerId: l.id,
                        billingEventId: eventId,
                        creditsDelta: costToCharge,
                    }, l.jobId || runId);
                }, {
                    timeout: 10000,
                });
            }
            catch (e) {
                this.logger.error(`[P1-C] Settlement failed for ledger ${l.id}: ${e.message}`);
                failedCount++;
                if (e.message === 'INSUFFICIENT_CREDITS') {
                    await this.prisma.billingLedger
                        .update({
                        where: { id: l.id },
                        data: { billingState: 'RELEASED' },
                    })
                        .catch(() => null);
                }
            }
        }
        this.logger.log(`[P1-C] Settlement summary: ${processedCount} BILLED, ${failedCount} FAILED`);
        const durationMs = Date.now() - startTime;
        if (failedCount === 0) {
            await this.recordAudit(null, projectId, 'billing.reconcile.pass', { processedCount, durationMs }, runId);
        }
        else {
            await this.recordAudit(null, projectId, 'billing.reconcile.fail', { processedCount, failedCount, durationMs }, runId);
        }
        return { processedCount, failedCount, durationMs };
    }
    async recordAudit(request, resourceId, action, details, traceId) {
        try {
            await this.auditLogService.record({
                userId: request?.user?.userId || undefined,
                apiKeyId: request?.apiKeyId || undefined,
                action,
                resourceType: 'billing',
                resourceId: resourceId || undefined,
                details,
                traceId,
                ip: request?.ip,
                userAgent: request?.headers?.['user-agent'],
            });
        }
        catch (e) {
            this.logger.error(`[P1-C] Audit Fail: ${action} - ${e.message}`);
        }
    }
};
exports.BillingSettlementService = BillingSettlementService;
exports.BillingSettlementService = BillingSettlementService = BillingSettlementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], BillingSettlementService);
//# sourceMappingURL=billing-settlement.service.js.map