import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync } from 'fs';

@Injectable()
export class AU03SFXGenAdapter extends AuBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('au03_sfx_gen', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  protected async processLogic(payload: any): Promise<any> {
    const desc = payload.description || 'impact';
    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/au/sfx');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.wav`);

    // FFmpeg: 生成噪声模拟音效
    const cmd = `ffmpeg -y -f lavfi -i "anoisesrc=d=1:c=white" "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: { description: desc, format: 'wav', duration: 1 },
    };
  }
}
