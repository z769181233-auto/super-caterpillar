import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { ce06RealEngine } from '../../../../../packages/engines/ce06';

/**
 * CE06LocalAdapter
 * Adapter for CE06 Novel Parsing Engine
 */
@Injectable()
export class CE06LocalAdapter implements EngineAdapter {
  public readonly name = 'ce06_novel_parsing';
  private readonly logger = new Logger(CE06LocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'ce06_novel_parsing';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`[CE06_ADAPTER] Invoking real engine for traceId=${input.context?.traceId}`);

    try {
      const output = await ce06RealEngine({
        ...input.payload,
        traceId: input.context?.traceId,
        projectId: input.context?.projectId,
      } as any);

      return {
        status: 'SUCCESS' as any,
        output,
        metrics: {
          tokens: output.billing_usage.totalTokens,
          latencyMs: output.latency_ms || 0,
        },
      };
    } catch (error: any) {
      this.logger.error(`[CE06_ADAPTER] Failed: ${error.message}`);
      return {
        status: 'FAILED' as any,
        error: {
          code: 'ADAPTER_EXECUTION_FAILED',
          message: error.message,
        },
      };
    }
  }
}
