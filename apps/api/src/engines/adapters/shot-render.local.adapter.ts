import { Injectable, Logger } from '@nestjs/common';
import {
    EngineAdapter,
    EngineInvokeInput,
    EngineInvokeResult,
} from '@scu/shared-types';
import { shotRenderRealEngine } from '@scu/engines-shot-render';

@Injectable()
export class ShotRenderLocalAdapter implements EngineAdapter {
    public readonly name = 'shot_render_local';
    private readonly logger = new Logger(ShotRenderLocalAdapter.name);

    supports(engineKey: string): boolean {
        return (
            engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render' ||
            engineKey === 'http_shot_render'
        );
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        this.logger.log(
            `[ShotRenderLocal] REAL Invocation for ${input.engineKey} (JobType=${input.jobType})`
        );

        try {
            // P0-R0: Call REAL engine from @scu/engines-shot-render
            const shotId = (input.context?.shotId || input.payload?.shotId) as string;
            const traceId = (input.context?.traceId || input.payload?.traceId) as string;

            const result = await shotRenderRealEngine({
                shotId,
                traceId,
                prompt: input.payload.prompt,
                width: input.payload.width || 1024,
                height: input.payload.height || 1024,
                seed: input.payload.seed,
            }, {
                traceId,
                model: 'sdxl' // 默认使用 SDXL
            });

            // 增强审计轨迹以满足计费和 Gate 断言要求
            if (result.audit_trail) {
                (result.audit_trail as any).providerSelected = result.render_meta?.model || 'sdxl-turbo-local';
            }

            return {
                status: 'SUCCESS' as any,
                output: result,
            };
        } catch (error: any) {
            this.logger.error(`[ShotRenderLocal] REAL Invocation Failed: ${error.message}`);
            return {
                status: 'FAILED' as any,
                error: {
                    code: 'SHOT_RENDER_REAL_FAILED',
                    message: error.message,
                },
            };
        }
    }
}
