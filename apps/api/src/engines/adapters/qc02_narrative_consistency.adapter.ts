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
export class QC02NarrativeConsistencyAdapter extends QcBaseEngine implements EngineAdapter {
  constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService) {
    super('qc02_narrative_consistency', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload || {});
  }

  protected async processLogic(
    payload: any,
    input: EngineInvokeInput
  ): Promise<{ status: 'PASS' | 'FAIL' | 'WARN'; reportUrl?: string; meta?: any; metrics?: any }> {
    // QC02: Narrative Consistency - Schema validation
    const required: string[] = ['storyBeat', 'dialogue'];
    const optional: string[] = ['shotId', 'sceneId', 'emotion'];

    let score = 100;
    const reasons: string[] = [];
    const checks: Record<string, boolean> = {};

    // Required fields check
    for (const field of required) {
      const exists = !!payload[field] && payload[field] !== '';
      checks[field] = exists;
      if (!exists) {
        score -= 40;
        reasons.push(`Missing required field: ${field}`);
      }
    }

    // Optional fields check (bonus points)
    for (const field of optional) {
      const exists = !!payload[field];
      checks[field] = exists;
      if (exists) {
        score += 5;
      }
    }

    // Length validation
    if (payload.storyBeat && payload.storyBeat.length < 3) {
      score -= 20;
      reasons.push('storyBeat too short');
    }
    if (payload.dialogue && payload.dialogue.length > 500) {
      score -= 10;
      reasons.push('dialogue too long');
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
    const outputDir = join(process.cwd(), 'storage/qc/narrative');
    mkdirSync(outputDir, { recursive: true });
    const reportPath = join(outputDir, `qc02_${hash}.json`);

    const report = {
      score,
      checks,
      reasons,
      payload_schema: Object.keys(payload),
      timestamp: new Date().toISOString(),
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return {
      status: score >= 80 ? 'PASS' : score >= 50 ? 'WARN' : 'FAIL',
      reportUrl: `file://${reportPath}`,
      metrics: { score, reasons },
    };
  }
}
