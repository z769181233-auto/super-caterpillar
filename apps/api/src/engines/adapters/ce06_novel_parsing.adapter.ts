import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { ce06Selector } from '@scu/engines-ce06';

import { LocalStorageService } from '../../storage/local-storage.service';

/**
 * CE06LocalAdapter
 * Adapter for CE06 Novel Parsing Engine
 */
@Injectable()
export class CE06LocalAdapter implements EngineAdapter {
  public readonly name = 'ce06_novel_parsing';
  private readonly logger = new Logger(CE06LocalAdapter.name);

  constructor(private readonly localStorage: LocalStorageService) { }

  supports(engineKey: string): boolean {
    return engineKey === 'ce06_novel_parsing';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`[CE06_ADAPTER] Invoking real engine for traceId=${input.context?.traceId}`);

    try {
      let payload = input.payload;

      // [P6-0 Fix] Resolve novelRef to structured_text
      if (payload.novelRef && payload.novelRef.storageKey) {
        this.logger.log(`[CE06_ADAPTER] Resolving novelRef: ${payload.novelRef.storageKey}`);
        const rawText = await this.localStorage.readString(payload.novelRef.storageKey);
        payload = {
          ...payload,
          structured_text: rawText,
        };
      }

      let model = payload.model || 'gemini-1.5-flash';
      if (model === 'gemini-1.5-flash') {
        model = 'gemini-flash-latest';
      }

      const output = await ce06Selector({
        ...payload,
        model,
        traceId: input.context?.traceId,
        projectId: input.context?.projectId,
      } as any);

      if (!output) {
        throw new Error('CE06 Engine returned null output');
      }

      return {
        status: 'SUCCESS' as any,
        output,
        metrics: {
          tokens: output.billing_usage ? output.billing_usage.totalTokens : 0,
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
