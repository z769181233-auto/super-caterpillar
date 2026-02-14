import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BillingEntry {
    tenantId: string;
    traceId: string; // JobId or TraceId
    itemType: string; // e.g., 'JOB'
    itemId: string;   // JobId
    chargeCode: string; // e.g., 'SCAN_CHAR', 'RENDER_CHAR'
    amount: number;
    currency?: string;
    status: 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';
    evidenceRef?: string;
}

@Injectable()
export class FinancialSettlementService {
    private readonly logger = new Logger(FinancialSettlementService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * P6-1-5: 幂等计费写入器
     * 基于 (tenantId, traceId, itemType, itemId, chargeCode) 唯一约束确保幂等
     */
    async writeBillingLedger(entry: BillingEntry): Promise<void> {
        try {
            await this.prisma.billingLedger.upsert({
                where: {
                    tenantId_traceId_itemType_itemId_chargeCode: {
                        tenantId: entry.tenantId,
                        traceId: entry.traceId,
                        itemType: entry.itemType,
                        itemId: entry.itemId,
                        chargeCode: entry.chargeCode,
                    },
                },
                create: {
                    tenantId: entry.tenantId,
                    traceId: entry.traceId,
                    itemType: entry.itemType,
                    itemId: entry.itemId,
                    chargeCode: entry.chargeCode,
                    amount: entry.amount,
                    currency: entry.currency || 'CREDIT',
                    status: entry.status,
                    evidenceRef: entry.evidenceRef,
                },
                update: {
                    // 幂等：如果已存在且是终态，则不再修改金额，但可以更新状态或凭证
                    status: entry.status,
                    evidenceRef: entry.evidenceRef,
                },
            });
            this.logger.log(`[FinancialSettlement] ✅ Ledger sync: ${entry.traceId} | ${entry.amount} ${entry.currency}`);
        } catch (error: any) {
            this.logger.error(`[FinancialSettlement] ❌ Error writing ledger:`, error);
            throw error;
        }
    }

    /**
     * CE06 计费口径：SCAN_CHAR = ceil(charCount / 10000) * 1 credit
     */
    calculateCE06Cost(charCount: number): number {
        if (!charCount || charCount <= 0) return 0;
        return Math.ceil(charCount / 10000);
    }

    /**
     * SHOT_RENDER 计费口径：1 credit per shot
     */
    calculateShotRenderCost(): number {
        return 1;
    }

    /**
     * VIDEO_RENDER 计费口迁：10 credits per video
     */
    calculateVideoRenderCost(): number {
        return 10;
    }
}
