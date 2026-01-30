import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * G5AssetLayeringResolverAdapter
 *
 * 强制合规：
 * 1. [LAYER ORDER]: Shadow(0) -> Torso(10) -> Face(20).
 * 2. [SHADOW]: 为每个角色添加 ellipse_soft 逻辑阴影。
 * 3. [FEATHERING]: 边缘羽化。
 */

@Injectable()
export class G5AssetLayeringResolverAdapter implements EngineAdapter {
  name = 'g5_asset_layering';
  private readonly logger = new Logger(G5AssetLayeringResolverAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'g5_asset_layering';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const started = Date.now();
    try {
      const { renderPlan, charactersDir, outputDir } = input.payload;
      if (!renderPlan) {
        throw new Error('G5_ASSET_LAYER: Missing renderPlan in payload');
      }

      const shots = renderPlan.renderShots || renderPlan.shots || [];
      const assignments: any[] = [];
      const defaultCharsDir = charactersDir || path.join(process.cwd(), 'assets/characters/v1');

      shots.forEach((shot: any) => {
        const shotId = shot.id || `shot-${shot.sequence_no || 0}`;
        const characterId = shot.characterId;

        if (!characterId) {
          assignments.push({ shotId, layers: [], status: 'NO_ACTOR' });
          return;
        }

        const charBase = path.join(defaultCharsDir, characterId);
        const layers: any[] = [];

        // 1. 检查是否存在分层组件
        const compDir = path.join(charBase, 'components');
        if (fs.existsSync(compDir)) {
          const comps = ['torso.png', 'head.png', 'arms.png'];
          comps.forEach((c, idx) => {
            const p = path.join(compDir, c);
            if (fs.existsSync(p)) {
              layers.push({
                layerId: c.replace('.png', ''),
                sourcePath: p,
                order: (idx + 1) * 10,
                offset: { x: 0, y: 0 },
              });
            }
          });
        }

        // 2. 如果无分层，使用 full.png
        if (layers.length === 0) {
          const full = path.join(charBase, 'full.png');
          if (fs.existsSync(full)) {
            layers.push({
              layerId: 'full',
              sourcePath: full,
              order: 10,
              offset: { x: 0, y: 0 },
            });
          }
        }

        // 3. 添加逻辑阴影 (Protocol Rule)
        const shadow = {
          enabled: true,
          type: 'ellipse_soft',
          params: { color: '#000000', opacity: 0.4, blur: 15, offset: { x: 0, y: 40 } },
        };

        assignments.push({
          shotId,
          characterId,
          layers: layers.sort((a, b) => a.order - b.order),
          shadow,
          blending: { mode: 'normal', feather: 2 },
        });
      });

      const result = {
        assignments,
        total_shots: shots.length,
        asset_base: defaultCharsDir,
      };

      if (outputDir) {
        const outPath = path.join(outputDir, 'layering_plan.json');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      }

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: result,
        metrics: {
          durationMs: Date.now() - started,
        },
      };
    } catch (error) {
      this.logger.error(`[G5-LAYER] Error: ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          code: 'G5_LAYER_ERROR',
          message: error.message,
        },
      };
    }
  }
}
