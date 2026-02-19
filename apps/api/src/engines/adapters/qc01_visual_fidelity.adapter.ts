import { Injectable } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { QcBaseEngine } from '../base/qc_base.engine';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, readdir, unlink, rmdir } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

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

      // 0. Prepare Metadata & Paths
      const hash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex')
        .substring(0, 16);
      const outputDir = join(process.cwd(), 'storage/qc/visual');
      const reportPath = join(outputDir, `qc01_${hash}.json`);
      mkdirSync(outputDir, { recursive: true });

      // 2. G5 Sharpness Analysis (Laplacian Variance)
      const frameDir = join(outputDir, `frames_${hash}`);
      let sharpnessMetrics = { p50: 0, p10: 0, scores: [] as number[] };

      try {
        if (duration > 0) {
          mkdirSync(frameDir, { recursive: true });

          // Extract 30 frames
          await execAsync(
            `ffmpeg -y -i "${filePath}" -vf "fps=30/${duration}" -vframes 30 "${join(frameDir, 'frame_%03d.jpg')}"`
          );

          const frameFiles = (await promisify(readdir)(frameDir))
            .filter((f: string) => f.endsWith('.jpg'))
            .map((f: string) => join(frameDir, f));

          if (frameFiles.length > 0) {
            const scores: number[] = [];

            // Laplacian Kernel
            const kernel = {
              width: 3,
              height: 3,
              kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
            };

            for (const frame of frameFiles) {
              const { data, info } = await sharp(frame)
                .grayscale()
                .raw() // Get raw pixel data
                .toBuffer({ resolveWithObject: true });

              const width = info.width;
              const height = info.height;

              // Apply Laplacian Convolution & Calculate Variance manually for performance/control
              // Or use sharp's convolve? Sharp's convolve returns an image.
              // Let's use sharp's convolve then stats.

              const stats = await sharp(frame)
                .grayscale()
                .convolve(kernel)
                .stats();

              // Variance = stdev^2. Sharp stats returns stdev.
              // Channel 0 is the grayscale channel.
              const stdev = stats.channels[0].stdev;
              const variance = stdev * stdev;
              scores.push(variance);
            }

            scores.sort((a, b) => a - b);
            const p50 = scores[Math.floor(scores.length * 0.5)] || 0;
            const p10 = scores[Math.floor(scores.length * 0.1)] || 0;

            sharpnessMetrics = { p50, p10, scores };

            // Cleanup frames
            await Promise.all(frameFiles.map((f: string) => promisify(unlink)(f)));
            await promisify(rmdir)(frameDir);
          }
        }
      } catch (e: any) {
        this.logger.warn(`[QC01] Sharpness analysis failed: ${e.message}`);
        reasons.push(`Sharpness check failed: ${e.message}`);
      }

      // G5 Gate Logic
      if (sharpnessMetrics.p50 < 360) {
        score -= 40; // Heavy penalty
        reasons.push(`Low Sharpness (P50=${sharpnessMetrics.p50.toFixed(1)} < 360)`);
      }
      if (sharpnessMetrics.p10 < 300) {
        score -= 10;
        reasons.push(`Inconsistent Sharpness (P10=${sharpnessMetrics.p10.toFixed(1)} < 300)`);
      }

      // Generate report
      const report = {
        score,
        checks: {
          resolution: `${width}x${height}`,
          codec,
          duration: `${duration}s`,
          sharpness_p50: sharpnessMetrics.p50,
          sharpness_p10: sharpnessMetrics.p10,
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
        metrics: { score, reasons, sharpness: sharpnessMetrics },
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
