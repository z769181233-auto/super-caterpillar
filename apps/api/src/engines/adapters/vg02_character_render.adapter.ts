import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync } from 'fs';

@Injectable()
export class VG02CharacterRenderAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg02_character_render', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的角色立绘逻辑 (REAL-STUB)
   */
  protected async processLogic(payload: any): Promise<any> {
    const char = payload.characterName || 'hero';
    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/char');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.png`);

    // FFmpeg: 生成立绘占位 (蓝色色块)
    const cmd = `ffmpeg -y -f lavfi -i color=c=white:s=512x512 -vf "drawbox=x=150:y=100:w=200:h=300:color=blue@0.7:t=fill" -frames:v 1 "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: { character: char, format: 'png' },
    };
  }
}
