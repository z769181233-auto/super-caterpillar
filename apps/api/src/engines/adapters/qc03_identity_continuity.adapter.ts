import { Injectable } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { QcBaseEngine } from '../base/qc_base.engine';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

@Injectable()
export class QC03IdentityContinuityAdapter extends QcBaseEngine implements EngineAdapter {
    constructor(
        redis: RedisService,
        audit: AuditService,
        cost: CostLedgerService
    ) {
        super('qc03_identity_continuity', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload || {});
    }

    protected async processLogic(payload: any, input: EngineInvokeInput): Promise<{ status: 'PASS' | 'FAIL' | 'WARN'; reportUrl?: string; meta?: any; metrics?: any }> {
        // QC03: Identity Continuity - Use deterministic score check
        const characterId = payload.characterId || 'unknown';
        const identityScore = payload.identityScore || payload.score || 0;

        // Threshold-based check (simulating ce23_identity_consistency)
        const threshold = 0.85;
        const reasons: string[] = [];

        if (!characterId || characterId === 'unknown') {
            reasons.push('Missing characterId');
        }
        if (identityScore < threshold) {
            reasons.push(`Identity score ${identityScore} below threshold ${threshold}`);
        }

        const passed = characterId && characterId !== 'unknown' && identityScore >= threshold;
        const score = passed ? 95 : (identityScore * 100);

        const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').substring(0, 16);
        const outputDir = join(process.cwd(), 'storage/qc/identity');
        mkdirSync(outputDir, { recursive: true });
        const reportPath = join(outputDir, `qc03_${hash}.json`);

        const report = {
            characterId,
            identityScore,
            threshold,
            continuityScore: score,
            passed,
            reasons,
            checks: {
                faceIdConsistency: passed ? 'MATCH' : 'MISMATCH',
                featureLock: 'ACTIVE'
            },
            timestamp: new Date().toISOString()
        };
        writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return {
            status: score >= 90 ? 'PASS' : (score >= 70 ? 'WARN' : 'FAIL'),
            reportUrl: `file://${reportPath}`,
            metrics: { score, reasons }
        };
    }
}
