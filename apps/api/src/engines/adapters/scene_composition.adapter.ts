import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sceneCompositionRealEngine } from '@scu/engines-scene-composition';
import { execAsync } from '../../../../../packages/shared/os_exec';

interface CompositionElement {
  id: string; // Added id for AI tracking
  url: string;
  description?: string; // Added description for AI context
  x?: number;
  y?: number;
  scale?: number;
}

@Injectable()
export class SceneCompositionAdapter implements EngineAdapter {
  public readonly name = 'scene_composition';
  private readonly logger = new Logger(SceneCompositionAdapter.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly costLedgerService: CostLedgerService
  ) { }

  supports(engineKey: string): boolean {
    return engineKey === 'scene_composition';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const payload = input.payload || {};
    const bgUrl = payload.background_url || '';
    const elements: CompositionElement[] = payload.elements || [];

    if (!bgUrl) {
      return {
        status: 'FAILED' as any,
        error: { code: 'SCENE_NO_BG', message: 'Missing background_url' },
      };
    }

    // 1. Calculate Cache Key (SHA256 of bg + elements)
    const inputStr = JSON.stringify({ bgUrl, elements });
    const inputHash = createHash('sha256').update(inputStr).digest('hex');
    const cacheKey = `scene_comp:v2:${inputHash}`;

    // 2. Check Cache
    try {
      const cached = await this.redisService.getJson(cacheKey);
      if (cached) {
        await this.auditHelper(input, 'HIT', cacheKey);
        await this.recordCost(input, 0, { cached: true });
        return {
          status: 'SUCCESS' as any,
          output: {
            ...cached,
            source: 'cache',
            meta: { inputHash, cached: true },
          },
        };
      }
    } catch (e) {
      this.logger.warn(`Cache check failed: ${e}`);
    }

    try {
      // 3. AI Composition Decision
      const aiResult = await sceneCompositionRealEngine.run({
        scene_description: payload.scene_description || payload.text || 'Normal composition',
        background_url: bgUrl,
        elements: elements as any,
      }) as any;

      // 4. Perform Composition (FFmpeg)
      const outputUrl = await this.composite(bgUrl, aiResult.elements, inputHash);

      const output = {
        url: outputUrl,
        status: 'success',
        layers: elements.length + 1,
        composition_mode: aiResult.composition_mode,
        ai_description: aiResult.description,
      };

      // 5. Save Cache (7 days)
      await this.redisService.setJson(cacheKey, output, 7 * 24 * 3600);

      // 6. Audit & Cost
      await this.auditHelper(input, 'MISS', cacheKey);
      await this.recordCost(input, 1);

      return {
        status: 'SUCCESS' as any,
        output: {
          ...output,
          source: 'render',
          ai_audit: aiResult.audit_trail?.engine_version,
        },
      };
    } catch (error: any) {
      this.logger.error(`[SceneComposition] Failed: ${error.message}`);
      // Failure Audit
      await this.auditHelper(input, 'MISS', 'failed_request', {
        status: 'FAILED',
        error: error.message,
      });
      await this.recordCost(input, 0, { status: 'FAILED' });

      return {
        status: 'FAILED' as any,
        error: {
          code: 'SCENE_RENDER_ERROR',
          message: error.message,
        },
      };
    }
  }

  private async composite(
    bgUrl: string,
    elements: CompositionElement[],
    hash: string
  ): Promise<string> {
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `scene_${hash}.png`);

    // Convert URLs to local paths if file://
    const getPath = (url: string) => (url.startsWith('file://') ? url.replace('file://', '') : url);

    const bgPath = getPath(bgUrl);
    // Ensure BG exists (basic check)
    if (!fs.existsSync(bgPath) && bgUrl.startsWith('file://')) {
      throw new Error(`Background file not found: ${bgPath}`);
    }

    const args: string[] = ['-y', '-i', bgPath];
    const filterChains: string[] = [];
    let lastLabel = '[0:v]';

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elPath = getPath(el.url);
      args.push('-i', elPath);

      const inputIdx = i + 1;
      const rawScale = typeof el.scale === 'number' ? el.scale : 1;
      const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
      const x = Number.isFinite(el.x as number) ? Number(el.x) : 0;
      const y = Number.isFinite(el.y as number) ? Number(el.y) : 0;
      const sourceLabel =
        scale !== 1 ? `[s${inputIdx}]` : `[${inputIdx}:v]`;

      if (scale !== 1) {
        filterChains.push(`[${inputIdx}:v]scale=iw*${scale}:ih*${scale}[s${inputIdx}]`);
      }

      const outLabel = `[v${inputIdx}]`;
      filterChains.push(`${lastLabel}${sourceLabel}overlay=${x}:${y}${outLabel}`);
      lastLabel = outLabel;
    }

    if (filterChains.length > 0) {
      args.push('-filter_complex', filterChains.join(';'), '-map', lastLabel);
    } else {
      args.push('-map', '0:v');
    }

    args.push('-frames:v', '1', outputPath);

    this.logger.log(`Executing FFmpeg: ffmpeg ${args.join(' ')}`);
    try {
      const res = await execAsync('ffmpeg', args);
      if (res.code !== 0) {
        throw new Error(res.stderr || `ffmpeg exited with code ${res.code}`);
      }
    } catch (e: any) {
      throw new Error(`FFmpeg Execution Failed: ${e.stderr || e.message}`);
    }

    return `file://${outputPath}`;
  }

  private async auditHelper(
    input: EngineInvokeInput,
    type: 'HIT' | 'MISS',
    resourceId: string,
    extraDetails: any = {}
  ) {
    await this.auditService.log({
      action: 'SCENE_COMPOSITION',
      resourceId: resourceId,
      resourceType: 'scene',
      details: {
        projectId: input.context.projectId,
        userId: input.context.userId || 'system',
        cache: type,
        traceId: input.context.traceId,
        ...extraDetails,
      },
    });
  }

  private async recordCost(input: EngineInvokeInput, amount: number, extraDetails: any = {}) {
    await this.costLedgerService.recordFromEvent({
      userId: input.context.userId || 'system',
      projectId: input.context.projectId || '',
      jobId: input.context.jobId,
      jobType: input.jobType || 'SCENE_COMPOSITION',
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: {
        type: 'scene_composition',
        traceId: input.context.traceId || 'unknown',
        ...extraDetails,
      },
    });
  }
}
