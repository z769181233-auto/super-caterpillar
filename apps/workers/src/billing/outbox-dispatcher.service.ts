import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import * as util from 'util';

/**
 * Billing Outbox Dispatcher
 * 
 * 商业级闭环：负责将 Worker 离线的计费事件重传至 API。
 * 支持退避重试和幂等确认。
 */
export class BillingOutboxDispatcher {
    private isProcessing = false;

    constructor(
        private prisma: PrismaClient,
        private apiClient: ApiClient
    ) { }

    /**
     * 启动扫描循环
     */
    start(intervalMs: number = 10000) {
        process.stdout.write(util.format(`[BillingOutbox] Dispatcher started with interval ${intervalMs}ms`) + '\n');
        setInterval(() => this.processPending(), intervalMs);
    }

    async processPending() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const pending = await this.prisma.billingOutbox.findMany({
                where: {
                    status: { in: ['PENDING', 'FAILED'] },
                    OR: [
                        { nextRetryAt: null },
                        { nextRetryAt: { lte: new Date() } }
                    ],
                    attempts: { lt: 10 } // Hard cap on retries
                },
                take: 20,
                orderBy: { createdAt: 'asc' }
            });

            if (pending.length === 0) {
                this.isProcessing = false;
                return;
            }

            process.stdout.write(util.format(`[BillingOutbox] Found ${pending.length} events to dispatch`) + '\n');

            for (const record of pending) {
                try {
                    const payload = record.payload as any;

                    await this.apiClient.postCostEvent(payload);

                    // Success: REMOVE or mark as SENT
                    // To keep DB lean, we can remove it, or mark as SENT for audit.
                    // Commercial choice: mark as SENT first, then cleanup later.
                    await this.prisma.billingOutbox.update({
                        where: { id: record.id },
                        data: {
                            status: 'SENT',
                            updatedAt: new Date()
                        }
                    });

                    process.stdout.write(util.format(`[BillingOutbox] ✅ Event dispatched: ${record.dedupeKey}`) + '\n');
                } catch (error: any) {
                    const nextRetry = new Date();
                    nextRetry.setSeconds(nextRetry.getSeconds() + Math.pow(2, record.attempts + 1) * 30); // Exponential backoff

                    await this.prisma.billingOutbox.update({
                        where: { id: record.id },
                        data: {
                            status: 'FAILED',
                            attempts: { increment: 1 },
                            lastError: error.message,
                            nextRetryAt: nextRetry,
                            updatedAt: new Date()
                        }
                    });

                    process.stderr.write(util.format(`[BillingOutbox] ❌ Dispatch failed for ${record.dedupeKey}: ${error.message}`) + '\n');
                }
            }
        } catch (e: any) {
            process.stderr.write(util.format(`[BillingOutbox] ‼️ Dispatcher loop error: ${e.message}`) + '\n');
        } finally {
            this.isProcessing = false;
        }
    }
}
