import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { vg03RealEngine } from '@scu/engines-vg03';

@Injectable()
export class VG03LightingEngineAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg03_lighting_engine', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的光照引擎逻辑 - 升级为 AI 驱动
   */
  protected async processLogic(payload: any): Promise<any> {
    const sourceUrl = payload.sourceUrl || '';
    const moodDescription = payload.moodDescription || payload.text || 'Neutral lighting';

    // 调用 AI 引擎计算光效
    const result = await vg03RealEngine.run({
      mood_description: moodDescription,
      lighting_preset: payload.lightingPreset,
    }) as any;

    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/lighting');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.png`);

    const sourcePath = sourceUrl.replace('file://', '');
    let inputArg = '';

    if (!sourcePath || !existsSync(sourcePath)) {
      inputArg = `-f lavfi -i color=c=gray:s=512x512`;
    } else {
      inputArg = `-i "${sourcePath}"`;
    }

    const cmd = `ffmpeg -y ${inputArg} -vf "${result.filter_string}" -frames:v 1 "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: {
        preset: result.preset,
        sourceUrl,
        format: 'png',
        ai: result.audit_trail.engine_version,
        parameters: result.parameters,
      },
    };
  }
}
