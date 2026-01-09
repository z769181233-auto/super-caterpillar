import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { CE04EngineSelector, CE04Input } from '@scu/engines/ce04';

/**
 * Visual Enrichment Local Adapter (Worker Side)
 * CE04: 视觉丰富度计算与扩展
 */
export class VisualEnrichmentLocalAdapterWorker implements EngineAdapter {
  public readonly name = 'ce04_visual_enrichment';
  private readonly selector = new CE04EngineSelector();

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();
    try {
      const payload = input.payload as CE04Input;

      // Invoke the selector (Real/Replay logic)
      const result = await this.selector.invoke(payload);

      if (!result) {
        throw new Error('CE04 Selector returned null');
      }

      const duration = Date.now() - startTime;

      return {
        status: 'SUCCESS' as EngineInvokeStatus,
        output: result,
        metrics: {
          durationMs: duration,
          tokensIn: result.billing_usage?.promptTokens || 0,
          tokensOut: result.billing_usage?.completionTokens || 0,
        },
      };
    } catch (error: any) {
      return {
        status: 'FAILED' as EngineInvokeStatus,
        error: {
          message: error.message,
          code: 'VISUAL_ENRICHMENT_ERROR',
          details: error.stack,
        },
        metrics: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}
