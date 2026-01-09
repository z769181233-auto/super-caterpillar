import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { CE03EngineSelector, CE03Input } from '@scu/engines/ce03';

/**
 * Visual Density Local Adapter (Worker Side)
 * CE03: 计算视觉密度指标
 */
export class VisualDensityLocalAdapterWorker implements EngineAdapter {
  public readonly name = 'ce03_visual_density';
  private readonly selector = new CE03EngineSelector();

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();
    try {
      const payload = input.payload as CE03Input;

      // Invoke the selector (Real/Replay logic)
      const result = await this.selector.invoke(payload);

      if (!result) {
        throw new Error('CE03 Selector returned null (Legacy Stub not supported)');
      }

      const duration = Date.now() - startTime;

      return {
        status: 'SUCCESS' as EngineInvokeStatus,
        output: result, // Full CE03Output including billing_usage
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
          code: 'VISUAL_DENSITY_ERROR',
          details: error.stack,
        },
        metrics: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}
