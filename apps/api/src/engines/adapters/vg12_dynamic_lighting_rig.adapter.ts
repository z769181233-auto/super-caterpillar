import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

/**
 * VG12: 动态灯光组引擎
 * 功能: 自动编排复杂的动态光源组与动画 (REAL-STUB)
 */
@Injectable()
export class VG12DynamicLightingRigAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg12_dynamic_lighting_rig', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 动态灯光组核心逻辑 (REAL-STUB)
   *
   * Payload 结构:
   * {
   *   sceneId: string,
   *   lightCount: number,
   *   mood: 'cinematic' | 'horror' | 'hope',
   *   rigSpeed: number
   * }
   */
  protected async processLogic(payload: any): Promise<any> {
    const sceneId = payload.sceneId || 'scene_default';
    const hash = this.generateCacheKey(payload).split(':').pop();

    const outputDir = join(process.cwd(), 'storage/vg/lighting_rig');
    mkdirSync(outputDir, { recursive: true });

    // 模拟灯光组坐标与动效
    const rigPath = join(outputDir, `${hash}_rig.json`);
    const rig = {
      sceneId,
      mood: payload.mood || 'cinematic',
      lights: Array.from({ length: payload.lightCount || 5 }).map((_, i) => ({
        id: `light_${i}`,
        type: 'spot',
        transform: { pos: { x: i * 2, y: 10, z: i * -5 }, rot: { x: -45, y: 0, z: 0 } },
        animation: 'pulse',
      })),
      timestamp: new Date().toISOString(),
    };

    writeFileSync(rigPath, JSON.stringify(rig, null, 2));

    // 生成预览图 (FFmpeg)
    const previewPath = join(outputDir, `${hash}_rig_preview.png`);
    this.generateRigPreview(previewPath, payload.mood);

    return {
      rigDataUrl: `file://${rigPath}`,
      previewImageUrl: `file://${previewPath}`,
      meta: {
        sceneId,
        mood: rig.mood,
        engine: 'vg12-lighting-rig-v1',
      },
    };
  }

  private generateRigPreview(outputPath: string, mood: string): void {
    let color = 'gold';
    if (mood === 'horror') color = 'darkblue';
    if (mood === 'hope') color = 'lightblue';

    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=512x256 -vf "drawgrid=w=50:h=50:t=2:c=yellow@0.5" -frames:v 1 "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (error) {
      writeFileSync(outputPath, '');
    }
  }
}
