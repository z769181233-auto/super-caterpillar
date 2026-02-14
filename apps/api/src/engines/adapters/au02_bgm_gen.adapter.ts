import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync } from 'fs';

import { AudioService } from '../../audio/audio.service';

@Injectable()
export class AU02BGMGenAdapter extends AuBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService,
    private readonly audioService: AudioService
  ) {
    super('au02_bgm_gen', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  protected async processLogic(payload: any): Promise<any> {
    const bgmSeed = payload.style || payload.seed || 'neutral';

    // P18-3: Use AudioService BGM logic
    const result = await this.audioService.generateBgm({
      text: bgmSeed,
      bgmSeed: bgmSeed,
      preview: payload.preview === true,
    });

    return {
      assetUrl: `file://${result.absPath}`,
      meta: {
        ...result.meta,
        style: bgmSeed,
        format: 'wav',
      },
    };
  }
}
