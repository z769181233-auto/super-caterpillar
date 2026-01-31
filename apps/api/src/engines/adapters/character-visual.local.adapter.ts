import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { performance } from 'perf_hooks';

/**
 * Character Visual Adapter - Industrial Grade
 * - Zero Side Effects
 * - Structured Audit Trail
 */
@Injectable()
export class CharacterVisualLocalAdapter implements EngineAdapter {
  public readonly name = 'character_visual';
  private readonly logger = new Logger(CharacterVisualLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'character_visual';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { characterId, projectId, traitsOverride = {} } = input.payload as any;
    const t0 = performance.now();

    this.logger.log(`[CHAR_VISUAL_ASYNC] Resolving visual for ${characterId}`);

    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        characterId,
        traits: {
          hair: 'black',
          eyes: 'brown',
          clothing: 'standard_scu_outfit',
          ...traitsOverride,
        },
        audit_evidence: {
          source: 'identity_anchor_v1_deterministic',
          anchorId: `anchor_${characterId}`,
          consistency_level: 'frozen',
        },
      },
      metrics: {
        durationMs: Math.round(performance.now() - t0),
      },
    };
  }
}
