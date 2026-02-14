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
 * VG09: 头发物理模拟引擎
 * 功能: 模拟高精头发动态物理 (REAL-STUB)
 */
@Injectable()
export class VG09HairPhysicsAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg09_hair_physics', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 头发物理核心逻辑 (REAL-STUB)
   *
   * Payload 结构:
   * {
   *   characterId: string,
   *   hairStyle: string,
   *   windForce: number,         // 风力强度
   *   windDirection: {x,y,z},    // 风向
   *   collisionCheck: boolean
   * }
   */
  protected async processLogic(payload: any): Promise<any> {
    const characterId = payload.characterId || 'char_default';
    const hairStyle = payload.hairStyle || 'long_straight';
    const hash = this.generateCacheKey(payload).split(':').pop();

    const outputDir = join(process.cwd(), 'storage/vg/hair');
    mkdirSync(outputDir, { recursive: true });

    // 模拟头发物理缓存数据
    const physicsDataPath = join(outputDir, `${hash}_physics.json`);
    const physicsData = {
      characterId,
      hairStyle,
      simulatedFrames: 120,
      collisionHits: payload.collisionCheck ? 15 : 0,
      averageMotionVector: { x: (payload.windDirection?.x || 1) * 0.1, y: 0.05, z: 0.02 },
      timestamp: new Date().toISOString(),
    };

    writeFileSync(physicsDataPath, JSON.stringify(physicsData, null, 2));

    // 生成预览图 (FFmpeg)
    const previewPath = join(outputDir, `${hash}_preview.png`);
    this.generateHairPreview(previewPath, hairStyle);

    return {
      physicsDataUrl: `file://${physicsDataPath}`,
      previewImageUrl: `file://${previewPath}`,
      meta: {
        characterId,
        hairStyle,
        engine: 'vg09-hair-phys-stub',
      },
    };
  }

  private generateHairPreview(outputPath: string, hairStyle: string): void {
    // 基于发型选择颜色
    let color = 'brown';
    if (hairStyle.includes('blonde')) color = 'gold';
    if (hairStyle.includes('raven')) color = 'black';

    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -vf "drawgrid=w=10:h=10:t=1:c=white@0.3" -frames:v 1 "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (error) {
      writeFileSync(outputPath, '');
    }
  }
}
