import { Injectable, Logger } from '@nestjs/common';
import {
    EngineAdapter,
    EngineInvokeInput,
    EngineInvokeResult,
} from '@scu/shared-types';
import { ce03RealEngine } from '@scu/engines/ce03';

/**
 * CE03LocalAdapter
 * Bridge to @scu/engines/ce03 real algorithm.
 */
@Injectable()
export class CE03LocalAdapter implements EngineAdapter {
    public readonly name = 'ce03_local_adapter';
    private readonly logger = new Logger(CE03LocalAdapter.name);

    supports(engineKey: string): boolean {
        return engineKey === 'ce03_visual_density';
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        this.logger.log(`Invoking CE03 Local Adapter for jobType=${input.jobType}`);

        try {
            // Transform common EngineInvokeInput to specific CE03Input
            const engineInput = {
                structured_text: input.payload?.structured_text || '',
                context: {
                    ...input.context,
                    projectId: input.context?.projectId || 'unknown',
                },
            };

            const output = await ce03RealEngine(engineInput);

            return {
                status: 'SUCCESS' as any,
                output,
                metrics: {
                    usage: output.billing_usage,
                },
            };
        } catch (error: any) {
            this.logger.error(`CE03 Local execution failed: ${error.message}`);
            return {
                status: 'FAILED' as any,
                error: {
                    message: error.message,
                    code: 'CE03_LOCAL_ERR',
                },
            };
        }
    }
}
