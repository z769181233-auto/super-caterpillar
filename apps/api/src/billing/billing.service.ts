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
}
