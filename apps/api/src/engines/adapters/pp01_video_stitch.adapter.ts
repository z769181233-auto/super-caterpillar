import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PpBaseEngine } from '../base/pp_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

@Injectable()
export class PP01VideoStitchAdapter extends PpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('pp01_video_stitch', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  protected async processLogic(payload: any): Promise<any> {
    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/pp/stitch');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.mp4`);

    // FFmpeg: 拼接两个 1秒的测试视频
    const cmd = `ffmpeg -y -f lavfi -i testsrc=d=1 -f lavfi -i testsrc=d=1 -filter_complex concat=n=2:v=1:a=0 "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: { format: 'mp4', duration: 2 },
    };
  }
}
