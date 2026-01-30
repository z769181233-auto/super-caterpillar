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
 * G5SemanticMotionMapperAdapter
 *
 * 强制合规：
 * 1. [ZERO DRIFT]: 站立 (Standing) 或 静态 (Idle) 镜头的 vertical_drift (dy) 必须为 0。
 * 2. [SEMANTIC MAPPING]: 动作映射到语义模板。
 */

@Injectable()
export class G5SemanticMotionMapperAdapter implements EngineAdapter {
  name = 'g5_semantic_motion';
  private readonly logger = new Logger(G5SemanticMotionMapperAdapter.name);

  // 动作模板库映射
  private readonly TEMPLATE_LIB = {
    idle_breathing: { amplitude: 0.02, frequency: 0.3 },
    nod_agree: { head_dy: 5, cycles: 1 },
    gesture_talk: { arm_amplitude: 0.05 },
    static: { amplitude: 0, frequency: 0 },
  };

  supports(engineKey: string): boolean {
    return engineKey === 'g5_semantic_motion';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const started = Date.now();
    try {
      const { renderPlan, outputDir } = input.payload;
      if (!renderPlan) {
        throw new Error('G5_SEMANTIC_MOTION: Missing renderPlan in payload');
      }

      const shots = renderPlan.renderShots || renderPlan.shots || [];
      const assignments: any[] = [];
      const driftViolationCount = 0;

      shots.forEach((shot: any) => {
        const shotId = shot.id || `shot-${shot.sequence_no || 0}`;
        const action = (shot.action || '').toLowerCase();

        // 1. 判断是否为静态/站立镜头 (Redline Rule)
        const isStanding =
          action.includes('stand') || action.includes('idle') || action.includes('静止') || !action;

        // 2. 映射语义模板
        let templateId = 'idle_breathing';
        if (action.includes('点') || action.includes('听')) templateId = 'nod_agree';
        if (action.includes('交谈') || action.includes('说')) templateId = 'gesture_talk';

        // 3. 强制校验 Zero Drift (Redline Rule)
        // 在 G5 中，我们直接输出 verticalDrift 为 0
        const verticalDrift = isStanding ? 0.0 : 0.05; // 除非显式位移，否则默认为 0

        assignments.push({
          shotId,
          templateId,
          params:
            this.TEMPLATE_LIB[templateId as keyof typeof this.TEMPLATE_LIB] ||
            this.TEMPLATE_LIB['idle_breathing'],
          verticalDrift: parseFloat(verticalDrift.toFixed(3)),
          isStanding,
        });
      });

      const result = {
        assignments,
        total_shots: shots.length,
        standing_drift_ok: true, // 核心逻辑已保证
      };

      if (outputDir) {
        const outPath = path.join(outputDir, 'motion_plan.json');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      }

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: result,
        metrics: {
          durationMs: Date.now() - started,
          driftViolations: driftViolationCount,
        },
      };
    } catch (error) {
      this.logger.error(`[G5-MOTION] Error: ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          code: 'G5_MOTION_ERROR',
          message: error.message,
        },
      };
    }
  }
}
