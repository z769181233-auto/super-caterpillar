import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        private readonly prisma: PrismaService
    ) { }

    /**
     * Get available credits for an organization.
     * Uses Organization's credits (Stage 10).
     */
    async getCredits(userId: string, organizationId: string): Promise<{ remaining: number; total: number }> {
        // Stage 10: Switch to Organization-centric billing
        if (!organizationId) {
            throw new ForbiddenException('Organization ID is required for billing check');
        }

        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { credits: true }
        });

        if (!org) throw new NotFoundException('Organization not found');

        const credits = org.credits || 0;
        return { remaining: credits, total: credits };
    }

    /**
     * Atomically consume credits.
     * Throws error if insufficient funds.
     */
    async consumeCredits(
        projectId: string,
        userId: string,
        organizationId: string,
        amount: number,
        type: string,
        traceId?: string
    ): Promise<boolean> {
        if (amount <= 0) return true;

        // Ensure organizationId is present
        if (!organizationId) throw new ForbiddenException('Organization ID is required');

        return this.prisma.$transaction(async (tx) => {
            // Atomic Update: Decrement credits ONLY if sufficient
            // We use updateMany to allow filtering by credits >= amount
            const result = await tx.organization.updateMany({
                where: {
                    id: organizationId,
                    credits: { gte: amount }
                },
                data: {
                    credits: { decrement: amount }
                }
            });

            if (result.count === 0) {
                // If update failed, check if it was because org missing or funds missing
                const org = await tx.organization.findUnique({ where: { id: organizationId } });
                if (!org) throw new NotFoundException('Organization not found');

                this.logger.warn(`Insufficient credits for Org ${organizationId}. Required: ${amount}, Available: ${org.credits}`);
                throw new ForbiddenException('Insufficient credits');
            }

            // 3. Record Billing Event (Ledger)
            await tx.billingEvent.create({
                data: {
                    projectId,
                    userId,
                    orgId: organizationId,
                    type: 'pay_as_you_go',
                    creditsDelta: -amount,
                    metadata: { type, traceId, legacyEventType: 'pay_as_you_go' }
                }
            });

            // 4. Audit Log (In-Transaction for Stage 10 Strict Consistency)
            const updatedOrg = await tx.organization.findUnique({ where: { id: organizationId } });
            const newCredits = updatedOrg?.credits ?? 0;
            const details = {
                amount,
                type,
                newCredits
            };

            // Construct payload manually to ensure consistency
            const payload = {
                action: 'BILLING_CONSUME',
                resourceType: 'job',
                resourceId: traceId,
                orgId: organizationId,
                details: JSON.parse(JSON.stringify(details)),
                timestamp: new Date().toISOString()
            };

            await tx.auditLog.create({
                data: {
                    userId,
                    orgId: organizationId,
                    action: 'BILLING_CONSUME',
                    resourceType: 'job',
                    resourceId: traceId,
                    details: details,
                    timestamp: new Date(),
                    payload: payload
                }
            });

            return true;
        });
    }

    async checkQuota(userId: string, organizationId: string, required: number = 1): Promise<boolean> {
        try {
            const { remaining } = await this.getCredits(userId, organizationId);
            return remaining >= required;
        } catch (e) {
            // NotFoundException: continue to throw (do not swallow)
            if (e instanceof NotFoundException) {
                throw e;
            }
            // Other exceptions: log and throw
            this.logger.error(`Error checking quota: ${e.message}`, e.stack);
            throw e;
        }
    }

    async createSubscription(userId: string, planId: string) {
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(now.getMonth() + 1);

        const subscription = await this.prisma.subscription.create({
            data: {
                userId,
                planId,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: nextMonth,
            },
        });
        return subscription;
    }

    async getSubscription(userId: string) {
        return this.prisma.subscription.findFirst({
            where: { userId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getPlans() {
        return [
            { id: 'free', name: 'Free Tier', price: 0, quota: { tokens: 100 } },
            { id: 'pro', name: 'Pro Tier', price: 29, quota: { tokens: 5000 } },
        ];
    }

    async getEvents(params: {
        projectId?: string;
        orgId?: string;
        from?: Date;
        to?: Date;
        type?: string;
        page?: number;
        pageSize?: number;
    }) {
        const { projectId, orgId, from, to, type, page = 1, pageSize = 20 } = params;
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (orgId) where.orgId = orgId;
        if (type) where.type = type;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = from;
            if (to) where.createdAt.lte = to;
        }

        const [items, total] = await Promise.all([
            this.prisma.billingEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.billingEvent.count({ where }),
        ]);

        return { items, total, page, pageSize };
    }

    async getLedgers(params: {
        projectId?: string;
        status?: any;
        jobType?: string;
        from?: Date;
        to?: Date;
        page?: number;
        pageSize?: number;
    }) {
        const { projectId, status, jobType, from, to, page = 1, pageSize = 20 } = params;
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (status) where.billingStatus = status;
        if (jobType) where.jobType = jobType;
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = from;
            if (to) where.createdAt.lte = to;
        }

        const [items, total] = await Promise.all([
            this.prisma.costLedger.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.costLedger.count({ where }),
        ]);

        return { items, total, page, pageSize };
    }

    async getSummary(projectId?: string, orgId?: string) {
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (orgId) where.orgId = orgId;

        const summary = await this.prisma.billingEvent.aggregate({
            where,
            _sum: {
                creditsDelta: true,
            },
            _count: {
                id: true,
            },
        });

        return {
            totalCreditsDelta: summary._sum?.creditsDelta || 0,
            eventCount: summary._count?.id || 0,
        };
    }

    async getReconcileStatus(projectId: string) {
        // SSOT: Reconcile Logic (Read-only version)
        const [ledgerSum, eventSum, billingEventsCount, billedLedgerCount] = await Promise.all([
            this.prisma.costLedger.aggregate({
                where: { projectId, billingStatus: 'BILLED' },
                _sum: { totalCredits: true }
            }),
            this.prisma.billingEvent.aggregate({
                where: { projectId },
                _sum: { creditsDelta: true }
            }),
            this.prisma.billingEvent.count({
                where: { projectId }
            }),
            this.prisma.costLedger.count({
                where: { projectId, billingStatus: 'BILLED' }
            })
        ]);

        const sumLedger = Number(ledgerSum._sum?.totalCredits || 0);
        const sumEvent = Math.abs(Number(eventSum._sum?.creditsDelta || 0));

        // Precision-safe comparison (ROUND 6 equivalent)
        const drift = Math.abs(sumLedger - sumEvent);
        const isConsistent = drift < 0.000001;

        return {
            projectId,
            isConsistent,
            drift,
            sumLedger,
            sumEvent,
            billedLedgerCount,
            billingEventsCount,
            timestamp: new Date()
        };
    }
}
