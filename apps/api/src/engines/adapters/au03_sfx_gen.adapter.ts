import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { execAsync } from '../../../../../packages/shared/os_exec';

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

    const res = await execAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anoisesrc=d=1:c=white',
      outputPath,
    ]);
    if (res.code !== 0) {
      throw new Error(`AU03 sfx failed: ${res.stderr}`);
    }

    return {
      assetUrl: `file://${outputPath}`,
      meta: { description: desc, format: 'wav', duration: 1 },
    };
  }
}
