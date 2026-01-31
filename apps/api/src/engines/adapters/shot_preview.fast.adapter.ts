import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { ShotRenderRouterAdapter } from './shot-render.router.adapter';
import { createHash } from 'crypto';

/**
 * Shot Preview Engine (Fast Adapter)
 * P1 Engine - PREV-1/2
 *
 * Logic:
 * 1. Check Redis for cached result (key derived from prompt + params)
 * 2. If miss: Invoke ShotRenderRouter with preview params (steps=10, 256x256)
 * 3. Cache result in Redis (TTL 3600s)
 * 4. Return result with source='cache' or 'render'
 */
@Injectable()
export class ShotPreviewFastAdapter implements EngineAdapter {
    public readonly name = 'shot_preview';
    private readonly logger = new Logger(ShotPreviewFastAdapter.name);

    constructor(
        private readonly redisService: RedisService,
        private readonly shotRenderRouter: ShotRenderRouterAdapter
    ) { }

    supports(engineKey: string): boolean {
        return engineKey === 'shot_preview';
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        try {
            const payload = input.payload || {};
            const prompt = payload.enrichedPrompt || payload.prompt || '';

            // 1. Derive Cache Key
            const promptHash = createHash('sha256').update(prompt).digest('hex');
            // Fixed preview params versioning
            const cacheKey = `preview:v1:${promptHash}`;

            // 2. Check Cache
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                // this.logger.log(`[ShotPreview] Cache HIT for ${cacheKey}`); 
                // Using debug log to reduce noise if needed, but info is fine
                return {
                    status: 'SUCCESS' as any,
                    output: {
                        ...(cached as any),
                        source: 'cache',
                        preview: true
                    }
                };
            }

            this.logger.log(`[ShotPreview] Cache MISS for ${cacheKey}. Rendering...`);

            // 3. Render (Delegation to Shot Render Router)
            const previewInput: EngineInvokeInput = {
                ...input,
                payload: {
                    ...payload,
                    width: 256,
                    height: 256,
                    steps: 10,
                    // Ensure we don't accidentally ask for high quality if upstream respects it
                    quality: 'preview',
                }
            };

            const result = await this.shotRenderRouter.invoke(previewInput);

            if (String(result.status) === 'SUCCESS' && result.output) {
                // 4. Cache Result (TTL 1 hour)
                await this.redisService.setJson(cacheKey, result.output, 3600);
            }

            return {
                ...result,
                output: {
                    ...result.output,
                    source: 'render',
                    preview: true
                }
            };

        } catch (error: any) {
            this.logger.error(`[ShotPreview] Failed: ${error.message}`);
            return {
                status: 'FAILED' as any,
                error: {
                    code: 'PREVIEW_FAIL',
                    message: error.message
                }
            };
        }
    }
}
