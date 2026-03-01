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
export class VG01BackgroundRenderAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg01_background_render', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的背景渲染逻辑 (REAL-STUB)
   * 使用 FFmpeg 生成纯色测试图
   */
  protected async processLogic(payload: any): Promise<any> {
    const prompt = payload.prompt || 'default_view';
    const style = payload.style || 'flat';

    // 确定性 Hash 作为文件名
    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/bg');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.png`);

    // FFmpeg Logic: 基于 prompt 决定颜色 (Mock)
    let color = '0x203040';
    if (prompt.includes('forest')) color = '0x104010';
    if (prompt.includes('sunset')) color = '0x803010';

    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=512x512 -frames:v 1 "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: { prompt, style, format: 'png', resolution: '512x512' },
    };
  }
}
