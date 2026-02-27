import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BillingEntry {
  tenantId: string;
  traceId: string; // JobId or TraceId
  itemType: string; // e.g., 'JOB'
  itemId: string; // JobId
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
   * @deprecated P3-A: Billing Ledger is now strictly managed by atomic Job State Transitions.
   * This non-transactional method is disabled.
   */
  async writeBillingLedger(entry: BillingEntry): Promise<void> {
    this.logger.debug(`[FinancialSettlement] Ignored obsolete legacy ledger write for ${entry.traceId}`);
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
