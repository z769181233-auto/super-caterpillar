import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { vg04RealEngine } from '@scu/engines-vg04';

@Injectable()
export class VG04CameraPathAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg04_camera_path', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的镜头路径逻辑 - 升级为 AI 驱动
   */
  protected async processLogic(payload: any): Promise<any> {
    const shotDescription = payload.shotDescription || payload.text || 'Static shot';
    const duration = payload.duration || 5;
    const fps = payload.fps || 24;

    // 调用 AI 引擎计算路径
    const result = await vg04RealEngine({
      shot_description: shotDescription,
      duration,
      fps,
      pacing_score: payload.pacing_score,
      emotional_intensity: payload.emotional_intensity,
    });

    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/path');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${hash}.json`);

    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          mode: result.mode,
          duration: result.duration,
          fps: result.fps,
          keyframes: result.keyframes,
          ai_description: result.description,
        },
        null,
        2
      )
    );

    return {
      assetUrl: `file://${outputPath}`,
      meta: {
        mode: result.mode,
        duration: result.duration,
        fps: result.fps,
        format: 'json',
        ai: result.audit_trail.engine_version,
      },
    };
  }
}
