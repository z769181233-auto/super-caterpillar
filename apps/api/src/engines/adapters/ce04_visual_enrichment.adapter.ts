import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { ce04RealEngine } from '../../../../../packages/engines/ce04';

/**
 * CE04LocalAdapter
 * Bridge to @scu/engines/ce04 real template enrichment.
 */
@Injectable()
export class CE04LocalAdapter implements EngineAdapter {
  public readonly name = 'ce04_local_adapter';
  private readonly logger = new Logger(CE04LocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'ce04_visual_enrichment';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`Invoking CE04 Local Adapter for jobType=${input.jobType}`);

    try {
      // Transform common EngineInvokeInput to specific CE04Input
      const engineInput = {
        structured_text: input.payload?.structured_text || '',
        style_prompt: input.payload?.style_prompt,
        style_guide: input.payload?.style_guide,
        context: {
          ...input.context,
          projectId: input.context?.projectId || 'unknown',
        },
      };

      const output = await ce04RealEngine(engineInput);

      return {
        status: 'SUCCESS' as any,
        output,
        metrics: {
          usage: output.billing_usage,
        },
      };
    } catch (error: any) {
      this.logger.error(`CE04 Local execution failed: ${error.message}`);
      return {
        status: 'FAILED' as any,
        error: {
          message: error.message,
          code: 'CE04_LOCAL_ERR',
        },
      };
    }
  }
}
