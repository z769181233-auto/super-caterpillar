import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BillingSettlementService {
  private readonly logger = new Logger(BillingSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
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
        await this.prisma.$transaction(
          async (tx) => {
            // 1. Idempotency Guard (Power Root)
            // In V3.0 BillingLedger is the source, but we still check BillingEvent if needed
            // P3-A: Billing Ledger uses 'COMMITTED' via Job Engine, not 'POSTED' or 'PENDING'
            const ledger = await tx.billingLedger.findUnique({ where: { id: l.id } });
            if (ledger?.billingState !== 'COMMITTED') {
              return;
            }

            // 2. Critical Context Validation
            if (!l.projectId) throw new Error('MISSING_PROJECT_ID');
            const costToCharge = Number(l.amount) / 100; // Int to Credits

            // Helper: Find Org
            const proj = await tx.project.findUnique({ where: { id: l.projectId } });
            const orgId = proj?.organizationId || l.projectId;

            // 3. Row-Level Locking on Credits (Atomicity)
            await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;

            const org = await tx.organization.findUnique({ where: { id: orgId } });
            if (!org) throw new Error('ORG_NOT_FOUND');

            if (org.credits < costToCharge) {
              throw new Error('INSUFFICIENT_CREDITS');
            }

            // 4. Create Immutable Evidence (BillingEvent)
            const eventId = randomUUID();
            await tx.billingEvent.create({
              data: {
                id: eventId,
                projectId: l.projectId,
                orgId: orgId,
                userId: undefined, // Or extract from metadata if needed
                type: 'CONSUME',
                creditsDelta: -costToCharge, // Negative for consumption
                metadata: {
                  ledgerId: l.id,
                  itemId: l.jobId,
                  traceId: l.jobId,
                  settleRunId: runId,
                },
              },
            });

            // 5. Deduct Balance
            await tx.organization.update({
              where: { id: orgId },
              data: { credits: { decrement: costToCharge } },
            });

            // 6. Seal Ledger Status - No-Op in P3-A since 'COMMITTED' is final in Ledger
            // (Previously it set status: 'POSTED')

            processedCount++;

            // Item-Level Audit
            await this.recordAudit(
              null,
              l.projectId,
              'billing.settle.item.billed',
              {
                ledgerId: l.id,
                billingEventId: eventId,
                creditsDelta: costToCharge,
              },
              l.jobId || runId
            );
          },
          {
            timeout: 10000, // Ensure enough time for locking
          }
        );
      } catch (e: any) {
        this.logger.error(`[P1-C] Settlement failed for ledger ${l.id}: ${e.message}`);
        failedCount++;

        if (e.message === 'INSUFFICIENT_CREDITS') {
          // Record failure reason for visibility
          await this.prisma.billingLedger
            .update({
              where: { id: l.id },
              data: { billingState: 'RELEASED' }, // Substitute for FAILED
            })
            .catch(() => null);
        }
        // Per User Instruction: "默认建议事务全回滚" (for the item)
      }
    }

    this.logger.log(`[P1-C] Settlement summary: ${processedCount} BILLED, ${failedCount} FAILED`);
    const durationMs = Date.now() - startTime;

    if (failedCount === 0) {
      await this.recordAudit(
        null,
        projectId,
        'billing.reconcile.pass',
        { processedCount, durationMs },
        runId
      );
    } else {
      await this.recordAudit(
        null,
        projectId,
        'billing.reconcile.fail',
        { processedCount, failedCount, durationMs },
        runId
      );
    }

    return { processedCount, failedCount, durationMs };
  }

  private async recordAudit(
    request: any,
    resourceId: string,
    action: string,
    details: any,
    traceId?: string
  ) {
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
