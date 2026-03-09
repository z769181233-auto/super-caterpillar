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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const distributed_lock_1 = require("../common/distributed-lock");
let BillingService = BillingService_1 = class BillingService {
    prisma;
    redis;
    logger = new common_1.Logger(BillingService_1.name);
    distributedLock = null;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
        if (this.redis) {
            this.distributedLock = new distributed_lock_1.DistributedLock({
                redis: this.redis,
                defaultTTL: 5000,
                maxRetries: 3,
                retryDelay: 100,
            });
            this.logger.log('[A5] Distributed lock initialized for billing');
        }
        else {
            this.logger.warn('[A5] Redis not available, distributed lock disabled (degraded mode)');
        }
    }
    async getCredits(userId, organizationId) {
        if (!organizationId) {
            throw new common_1.ForbiddenException('Organization ID is required for billing check');
        }
        const org = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { credits: true },
        });
        if (!org)
            throw new common_1.NotFoundException('Organization not found');
        const credits = org.credits || 0;
        return { remaining: credits, total: credits };
    }
    async consumeCredits(projectId, userId, organizationId, amount, type, traceId) {
        if (amount <= 0)
            return true;
        if (!organizationId)
            throw new common_1.ForbiddenException('Organization ID is required');
        console.error(`[BILLING_DEBUG] consumeCredits orgId=${organizationId} amount=${amount} type=${type}`);
        if (this.distributedLock) {
            const lockKey = `billing:consume:${organizationId}`;
            return this.distributedLock.withLock(lockKey, async () => {
                return this._doConsumeCredits(projectId, userId, organizationId, amount, type, traceId);
            }, 10000);
        }
        else {
            this.logger.warn('[A5] Executing without distributed lock (degraded mode)');
            return this._doConsumeCredits(projectId, userId, organizationId, amount, type, traceId);
        }
    }
    async _doConsumeCredits(projectId, userId, organizationId, amount, type, traceId) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.organization.updateMany({
                where: {
                    id: organizationId,
                    credits: { gte: amount },
                },
                data: {
                    credits: { decrement: amount },
                },
            });
            if (result.count === 0) {
                const org = await tx.organization.findUnique({ where: { id: organizationId } });
                if (!org)
                    throw new common_1.NotFoundException('Organization not found');
                this.logger.warn(`[A5] Insufficient credits for Org ${organizationId}. Required: ${amount}, Available: ${org.credits}`);
                throw new common_1.ForbiddenException(`Insufficient credits to start job. Required: ${amount} credits. (Available: ${org.credits})`);
            }
            let finalUserId = userId;
            const userExists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
            if (!userExists) {
                finalUserId = 'system';
            }
            await tx.billingEvent.create({
                data: {
                    projectId,
                    userId: finalUserId,
                    orgId: organizationId,
                    type: 'pay_as_you_go',
                    creditsDelta: -amount,
                    metadata: { type, traceId, legacyEventType: 'pay_as_you_go', originalUserId: userId },
                },
            });
            const updatedOrg = await tx.organization.findUnique({ where: { id: organizationId } });
            const newCredits = updatedOrg?.credits ?? 0;
            const details = {
                amount,
                type,
                newCredits,
                lockProtected: this.distributedLock !== null,
            };
            const payload = {
                action: 'BILLING_CONSUME',
                resourceType: 'job',
                resourceId: traceId,
                orgId: organizationId,
                details: JSON.parse(JSON.stringify(details)),
                timestamp: new Date().toISOString(),
            };
            await tx.auditLog.create({
                data: {
                    userId: finalUserId,
                    orgId: organizationId,
                    action: 'BILLING_CONSUME',
                    resourceType: 'job',
                    resourceId: traceId,
                    details: details,
                    timestamp: new Date(),
                    payload: payload,
                },
            });
            return true;
        });
    }
    async checkQuota(userId, organizationId, required = 1) {
        try {
            const { remaining } = await this.getCredits(userId, organizationId);
            return remaining >= required;
        }
        catch (e) {
            if (e instanceof common_1.NotFoundException) {
                throw e;
            }
            this.logger.error(`Error checking quota: ${e.message}`, e.stack);
            throw e;
        }
    }
    async createSubscription(userId, planId) {
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
    async getSubscription(userId) {
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
    async getEvents(params) {
        const { projectId, orgId, from, to, type, page = 1, pageSize = 20 } = params;
        const where = {};
        if (projectId)
            where.projectId = projectId;
        if (orgId)
            where.orgId = orgId;
        if (type)
            where.type = type;
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = from;
            if (to)
                where.createdAt.lte = to;
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
    async getLedgers(params) {
        const { projectId, status, jobType, from, to, page = 1, pageSize = 20 } = params;
        const where = {};
        if (projectId)
            where.tenantId = projectId;
        if (status)
            where.status = status;
        if (jobType)
            where.itemType = jobType;
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = from;
            if (to)
                where.createdAt.lte = to;
        }
        const [items, total] = await Promise.all([
            this.prisma.billingLedger.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.billingLedger.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async getSummary(projectId, orgId) {
        const where = {};
        if (projectId)
            where.projectId = projectId;
        if (orgId)
            where.orgId = orgId;
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
    async getReconcileStatus(projectId) {
        const [ledgerSum, eventSum, billingEventsCount, billedLedgerCount] = await Promise.all([
            this.prisma.billingLedger.aggregate({
                where: { projectId: projectId, billingState: 'COMMITTED' },
                _sum: { amount: true },
            }),
            this.prisma.billingEvent.aggregate({
                where: { projectId },
                _sum: { creditsDelta: true },
            }),
            this.prisma.billingEvent.count({
                where: { projectId },
            }),
            this.prisma.billingLedger.count({
                where: { projectId: projectId, billingState: 'COMMITTED' },
            }),
        ]);
        const sumLedger = Number(ledgerSum._sum?.amount || 0n) / 100;
        const sumEvent = Math.abs(Number(eventSum._sum?.creditsDelta || 0));
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
            timestamp: new Date(),
        };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], BillingService);
//# sourceMappingURL=billing.service.enhanced.js.map