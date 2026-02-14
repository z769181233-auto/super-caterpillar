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
 * VG10: 布料动力学引擎
 * 功能: 模拟衣物与织物物理动态 (REAL-STUB)
 */
@Injectable()
export class VG10ClothDynamicsAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg10_cloth_dynamics', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 布料动力学核心逻辑 (REAL-STUB)
   *
   * Payload 结构:
   * {
   *   characterId: string,
   *   clothType: 'silk' | 'cotton' | 'leather',
   *   gravity: number,
   *   animationSync: boolean
   * }
   */
  protected async processLogic(payload: any): Promise<any> {
    const characterId = payload.characterId || 'char_default';
    const clothType = payload.clothType || 'cotton';
    const hash = this.generateCacheKey(payload).split(':').pop();

    const outputDir = join(process.cwd(), 'storage/vg/cloth');
    mkdirSync(outputDir, { recursive: true });

    // 模拟布料动态数据
    const dynamicsPath = join(outputDir, `${hash}_dynamics.json`);
    const dynamics = {
      characterId,
      clothType,
      stiffness: clothType === 'leather' ? 0.9 : 0.3,
      friction: 0.5,
      vertexCount: 5000,
      timestamp: new Date().toISOString(),
    };

    writeFileSync(dynamicsPath, JSON.stringify(dynamics, null, 2));

    // 生成预览图 (FFmpeg)
    const previewPath = join(outputDir, `${hash}_preview.png`);
    this.generateClothPreview(previewPath, clothType);

    return {
      dynamicsDataUrl: `file://${dynamicsPath}`,
      previewImageUrl: `file://${previewPath}`,
      meta: {
        characterId,
        clothType,
        engine: 'vg10-cloth-dyn-stub',
      },
    };
  }

  private generateClothPreview(outputPath: string, clothType: string): void {
    let color = 'lightgray';
    if (clothType === 'silk') color = 'violet';
    if (clothType === 'leather') color = 'darkred';

    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -vf "noise=alls=20:allf=t" -frames:v 1 "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (error) {
      writeFileSync(outputPath, '');
    }
  }
}
