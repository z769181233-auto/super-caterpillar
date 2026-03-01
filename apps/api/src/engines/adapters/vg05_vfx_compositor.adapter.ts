import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { vg05RealEngine } from '@scu/engines-vg05';

@Injectable()
export class VG05VFXCompositorAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg05_vfx_compositor', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的 VFX 合成逻辑 - 升级为 AI 驱动
   */
  protected async processLogic(payload: any): Promise<any> {
    const sourceUrl = payload.sourceUrl || '';
    const sceneContext = payload.sceneContext || payload.text || 'Normal scene';

    // 调用 AI 引擎推荐特效
    const result = await vg05RealEngine({
      scene_context: sceneContext,
      pacing_score: payload.pacing_score,
    });

    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/vfx');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.png`);

    const sourcePath = sourceUrl.replace('file://', '');
    let inputArg = '';
    if (!sourcePath || !existsSync(sourcePath)) {
      inputArg = `-f lavfi -i color=c=0x111111:s=512x512`;
    } else {
      inputArg = `-i "${sourcePath}"`;
    }

    const cmd = `ffmpeg -y ${inputArg} -vf "${result.filter_string}" -frames:v 1 "${outputPath}"`;
    execSync(cmd, { stdio: 'ignore' });

    return {
      assetUrl: `file://${outputPath}`,
      meta: {
        vfx: result.vfx_preset,
        intensity: result.intensity,
        sourceUrl,
        format: 'png',
        ai: result.audit_trail.engine_version,
      },
    };
  }
}
