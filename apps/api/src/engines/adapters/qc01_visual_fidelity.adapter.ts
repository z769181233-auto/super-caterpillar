import { Injectable } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { QcBaseEngine } from '../base/qc_base.engine';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

@Injectable()
export class QC01VisualFidelityAdapter extends QcBaseEngine implements EngineAdapter {
  constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService) {
    super('qc01_visual_fidelity', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload || {});
  }

  protected async processLogic(
    payload: any,
    input: EngineInvokeInput
  ): Promise<{ status: 'PASS' | 'FAIL' | 'WARN'; reportUrl?: string; meta?: any; metrics?: any }> {
    // QC01: Visual Fidelity - Use ffprobe for deterministic verification
    const url =
      payload.url || (payload.output && (payload.output.url || payload.output.assetUrl)) || '';

    if (!url) {
      return {
        status: 'FAIL',
        metrics: { score: 0, reasons: ['No URL provided'] },
      };
    }

    // Handle file:// protocol
    const filePath = url.startsWith('file://') ? url.replace('file://', '') : url;

    try {
      // Execute ffprobe to get real metadata
      const { stdout } = await execAsync(
        `ffprobe -v error -show_streams -show_format -of json "${filePath}"`
      );
      const probe = JSON.parse(stdout);

      const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video');
      const duration = parseFloat(probe.format?.duration || '0');
      const width = videoStream?.width || 0;
      const height = videoStream?.height || 0;
      const codec = videoStream?.codec_name || 'unknown';

      // Deterministic scoring
      let score = 100;
      const reasons: string[] = [];

      if (duration <= 0) {
        score -= 50;
        reasons.push('Invalid duration');
      }
      if (width < 640 || height < 480) {
        score -= 30;
        reasons.push('Resolution too low');
      }
      if (codec === 'unknown') {
        score -= 20;
        reasons.push('Codec unidentified');
      }

      // Generate report
      const hash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex')
        .substring(0, 16);
      const outputDir = join(process.cwd(), 'storage/qc/visual');
      mkdirSync(outputDir, { recursive: true });
      const reportPath = join(outputDir, `qc01_${hash}.json`);

      const report = {
        score,
        checks: {
          resolution: `${width}x${height}`,
          codec,
          duration: `${duration}s`,
          integrity: score >= 80 ? 'Verified' : 'Degraded',
        },
        reasons,
        ffprobe_output: probe,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      return {
        status: score >= 80 ? 'PASS' : score >= 60 ? 'WARN' : 'FAIL',
        reportUrl: `file://${reportPath}`,
        metrics: { score, reasons },
      };
    } catch (err: any) {
      // ffprobe failed - file might not exist or be corrupt
      return {
        status: 'FAIL',
        metrics: { score: 0, reasons: [`ffprobe error: ${err.message}`] },
      };
    }
  }
}
