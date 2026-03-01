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
 * G5DialogueBindingAdapter
 *
 * 强制合规：
 * 1. [100% Coverage]: 每个 Beat 必须有对白。
 * 2. [Timing Buffer]: 对白起止时间与 Shot 边缘保持 0.5s 距离。
 * 3. [Narration Fallback]: 无对白则补全 NARRATOR 记录。
 */

interface DialogueEntry {
  shotId: string;
  speaker: string;
  text: string;
  startSec: number;
  endSec: number;
  beatId: string;
}

@Injectable()
export class G5DialogueBindingAdapter implements EngineAdapter {
  name = 'g5_dialogue_binding';
  private readonly logger = new Logger(G5DialogueBindingAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'g5_dialogue_binding';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const started = Date.now();
    try {
      const { story, renderPlan, outputDir } = input.payload;

      if (!story || !renderPlan) {
        throw new Error('G5_DIALOGUE_BINDING: Missing story or renderPlan in payload');
      }

      this.logger.log(`[G5-DIALOGUE] Processing ${renderPlan.episodeId || 'unknown'}...`);

      const dialogues: DialogueEntry[] = [];
      const beats = story.beats || [];
      const shots = renderPlan.renderShots || renderPlan.shots || [];

      // Timing Buffer Constants
      const START_BUFFER = 0.5;
      const END_BUFFER = 0.5;

      beats.forEach((beat: any) => {
        const beatId = beat.id;
        const associatedShots = shots.filter((s: any) => s.beatId === beatId);

        if (associatedShots.length === 0) {
          this.logger.warn(`[G5-DIALOGUE] Beat ${beatId} has no associated shots. Skipping.`);
          return;
        }

        // 获取该 Beat 下的第一个 Shot
        const firstShot = associatedShots[0];
        const shotId = firstShot.id || `shot-${firstShot.sequence_no || 0}`;

        // 规则 1 & 4: 100% Coverage + Fallback
        const text = beat.dialogue || beat.text || `[旁白] ${beat.goal || '正在发生'}`;
        const speaker = beat.speaker && beat.speaker !== 'UNKNOWN' ? beat.speaker : 'NARRATOR';

        // 规则 3: Timing Buffer
        // 计算在 Shot 内的绝对时间 (假设 shot.startSec 已对齐)
        const shotStart = firstShot.startSec || 0;
        const shotDuration =
          firstShot.duration_sec ||
          (firstShot.durationFrames ? firstShot.durationFrames / 24 : 3.0);

        const dStart = shotStart + START_BUFFER;
        const dEnd = Math.min(
          shotStart + shotDuration - END_BUFFER,
          dStart + (beat.durationSec || 2.0)
        );

        dialogues.push({
          shotId,
          speaker,
          text,
          startSec: parseFloat(dStart.toFixed(3)),
          endSec: parseFloat(dEnd.toFixed(3)),
          beatId,
        });
      });

      const result = {
        dialogue_plan: dialogues,
        total_dialogues: dialogues.length,
        coverage_pct: beats.length > 0 ? dialogues.length / beats.length : 1.0,
      };

      if (outputDir) {
        const outPath = path.join(outputDir, 'dialogue_plan.json');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      }

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: result,
        metrics: {
          durationMs: Date.now() - started,
          count: dialogues.length,
        },
      };
    } catch (error) {
      this.logger.error(`[G5-DIALOGUE] Error: ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          code: 'G5_DIALOGUE_ERROR',
          message: error.message,
        },
      };
    }
  }
}
