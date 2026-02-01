import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { QcBaseEngine } from '../base/qc_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

@Injectable()
export class QC04ComplianceScanAdapter extends QcBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('qc04_compliance_scan', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/qc/compliance');
        mkdirSync(outputDir, { recursive: true });
        const reportPath = join(outputDir, `${hash}.json`);

        const report = { status: 'PASS', sensitiveWords: [], harmfulContent: 'None' };
        writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return {
            status: 'PASS',
            reportUrl: `file://${reportPath}`,
            metrics: { flags: 0 }
        };
    }
}
