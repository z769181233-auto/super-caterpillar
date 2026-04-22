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
export class AU01VoiceTTSAdapter extends AuBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService,
    private readonly audioService: AudioService
  ) {
    super('au01_voice_tts', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  protected async processLogic(payload: any): Promise<any> {
    const text = payload.text || 'hello';

    // Use AudioService for real/truth generation logic
    const result = await this.audioService.generateAndMix({
      text,
      projectSettings: {
        audioRealEnabled: true, // Default to real if configured
        audioBgmEnabled: false,
      },
      preview: payload.preview === true,
    });

    return {
      assetUrl: `file://${result.voice.absPath}`,
      meta: {
        ...result.voice.meta,
        text,
        format: 'wav',
      },
    };
  }
}
