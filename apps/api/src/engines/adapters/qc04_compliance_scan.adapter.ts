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
export class QC04ComplianceScanAdapter extends QcBaseEngine implements EngineAdapter {
  constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService) {
    super('qc04_compliance_scan', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload || {});
  }

  protected async processLogic(
    payload: any,
    input: EngineInvokeInput
  ): Promise<{ status: 'PASS' | 'FAIL' | 'WARN'; reportUrl?: string; meta?: any; metrics?: any }> {
    // QC04: Compliance Scan - Deterministic rule-based scanning
    const text = JSON.stringify(payload);

    // Multi-level compliance rules
    const sensitiveWords = ['password', 'secret', 'admin', 'hack', 'exploit'];
    const warningWords = ['test', 'debug', 'temp'];
    const bannedPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b[A-Z]\d{5}\b/, // Potential ID pattern
    ];

    const violations: string[] = [];
    const warnings: string[] = [];

    // Keyword scan
    for (const word of sensitiveWords) {
      if (text.toLowerCase().includes(word)) {
        violations.push(`Sensitive keyword: ${word}`);
      }
    }
    for (const word of warningWords) {
      if (text.toLowerCase().includes(word)) {
        warnings.push(`Warning keyword: ${word}`);
      }
    }

    // Pattern scan
    for (const pattern of bannedPatterns) {
      if (pattern.test(text)) {
        violations.push(`Banned pattern matched: ${pattern.source}`);
      }
    }

    const status: 'PASS' | 'FAIL' | 'WARN' =
      violations.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
    const outputDir = join(process.cwd(), 'storage/qc/compliance');
    mkdirSync(outputDir, { recursive: true });
    const reportPath = join(outputDir, `qc04_${hash}.json`);

    const report = {
      scanResults: {
        violations,
        warnings,
        policy: 'V1.1_Standard',
        isSafe: violations.length === 0,
        verdict: status,
      },
      timestamp: new Date().toISOString(),
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return {
      status,
      reportUrl: `file://${reportPath}`,
      metrics: { violations: violations.length, warnings: warnings.length },
    };
  }
}
