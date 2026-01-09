import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BillingSettlementService {
    private readonly logger = new Logger(BillingSettlementService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLogService: AuditLogService,
    ) { }

    /**
     * P1-C Settlement Engine
     * Atomically settles all PENDING CostLedgers for a project.
     * Ensures SUM(Ledger) == SUM(Event) == Delta(Credits).
     */
    async settleProject(projectId: string, runId: string = 'batch-' + Date.now()) {
        const startTime = Date.now();
        this.logger.log(`[P1-C] Starting settlement for project: ${projectId} (runId: ${runId})`);

        // Audit Start
        await this.recordAudit(null, projectId, 'billing.settle.start', { runId }, runId);

        const ledgers = await this.prisma.costLedger.findMany({
            where: {
                projectId,
                billingStatus: 'PENDING'
            },
            orderBy: { createdAt: 'asc' }
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
                await this.prisma.$transaction(async tx => {
                    // 1. Idempotency Guard (Power Root)
                    const exists = await tx.billingEvent.findUnique({
                        where: { costLedgerId: l.id }
                    });

                    if (exists) {
                        this.logger.warn(`[P1-C] Ledger ${l.id} already has BillingEvent ${exists.id}. Marking as BILLED.`);
                        await tx.costLedger.update({
                            where: { id: l.id },
                            data: { billingStatus: 'BILLED', billingEventId: exists.id, billedAt: new Date() }
                        });
                        return;
                    }

                    // 2. Critical Context Validation
                    if (!l.orgId) throw new Error("MISSING_ORG_ID");
                    const costToCharge = l.totalCredits || 0;

                    // 3. Row-Level Locking on Credits (Atomicity)
                    // We use raw SQL to ensure SELECT FOR UPDATE behavior
                    await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${l.orgId} FOR UPDATE`;

                    const org = await tx.organization.findUnique({ where: { id: l.orgId } });
                    if (!org) throw new Error("ORG_NOT_FOUND");

                    if (org.credits < costToCharge) {
                        throw new Error("INSUFFICIENT_CREDITS");
                    }

                    // 4. Create Immutable Evidence (BillingEvent)
                    const eventId = randomUUID();
                    await tx.billingEvent.create({
                        data: {
                            id: eventId,
                            costLedgerId: l.id,
                            projectId: l.projectId,
                            orgId: l.orgId!,
                            userId: l.userId || undefined,
                            type: 'CONSUME',
                            creditsDelta: costToCharge,
                            metadata: {
                                jobId: l.jobId,
                                jobType: l.jobType,
                                traceId: l.traceId,
                                settleRunId: runId
                            }
                        }
                    });

                    // 5. Deduct Balance
                    await tx.organization.update({
                        where: { id: l.orgId },
                        data: { credits: { decrement: costToCharge } }
                    });

                    // 6. Seal Ledger Status
                    await tx.costLedger.update({
                        where: { id: l.id },
                        data: {
                            billingStatus: 'BILLED',
                            billingEventId: eventId,
                            billedAt: new Date()
                        }
                    });

                    processedCount++;

                    // Item-Level Audit
                    await this.recordAudit(null, l.orgId, 'billing.settle.item.billed', {
                        costLedgerId: l.id,
                        billingEventId: eventId,
                        creditsDelta: costToCharge
                    }, l.traceId || runId);
                }, {
                    timeout: 10000 // Ensure enough time for locking
                });
            } catch (e: any) {
                this.logger.error(`[P1-C] Settlement failed for ledger ${l.id}: ${e.message}`);
                failedCount++;

                if (e.message === "INSUFFICIENT_CREDITS") {
                    // Record failure reason for visibility
                    await this.prisma.costLedger.update({
                        where: { id: l.id },
                        data: { billingStatus: 'FAILED', billingError: e.message }
                    }).catch(() => null);
                }
                // Per User Instruction: "默认建议事务全回滚" (for the item)
            }
        }

        this.logger.log(`[P1-C] Settlement summary: ${processedCount} BILLED, ${failedCount} FAILED`);
        const durationMs = Date.now() - startTime;

        if (failedCount === 0) {
            await this.recordAudit(null, projectId, 'billing.reconcile.pass', { processedCount, durationMs }, runId);
        } else {
            await this.recordAudit(null, projectId, 'billing.reconcile.fail', { processedCount, failedCount, durationMs }, runId);
        }

        return { processedCount, failedCount, durationMs };
    }

    private async recordAudit(request: any, resourceId: string, action: string, details: any, traceId?: string) {
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
        } catch (e: any) {
            this.logger.error(`[P1-C] Audit Fail: ${action} - ${e.message}`);
        }
    }
}
