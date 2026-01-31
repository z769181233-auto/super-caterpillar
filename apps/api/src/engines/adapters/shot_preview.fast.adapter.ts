import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { ShotRenderRouterAdapter } from './shot-render.router.adapter';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';

/**
 * Shot Preview Engine (Fast Adapter) - REAL
 * P1 Engine - PREV-1/2
 *
 * Logic:
 * 1. Check Redis for cached result
 *    Key: preview:v1:<sha256(input+seed+style+size+steps)>
 * 2. If miss: Invoke ShotRenderRouter (preview=true)
 *    - Validate URL (no mock://)
 *    - Write to Redis (TTL 7 days)
 *    - Audit & Cost (engine=shot_preview)
 * 3. If hit:
 *    - Audit & Cost (engine=shot_preview, cost=0)
 *    - Return result
 */
@Injectable()
export class ShotPreviewFastAdapter implements EngineAdapter {
    public readonly name = 'shot_preview';
    private readonly logger = new Logger(ShotPreviewFastAdapter.name);

    constructor(
        private readonly redisService: RedisService,
        private readonly shotRenderRouter: ShotRenderRouterAdapter,
        private readonly auditService: AuditService,
        private readonly costLedgerService: CostLedgerService
    ) { }

    supports(engineKey: string): boolean {
        return engineKey === 'shot_preview';
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        try {
            const payload = input.payload || {};
            const prompt = payload.enrichedPrompt || payload.prompt || '';
            const seed = payload.seed || 0;
            const style = payload.style || 'default';
            const width = 256;
            const height = 256;
            const steps = 10;

            // 1. Derive Strict Cache Key
            // cacheKey = preview:v1:<sha256(input+seed+style+size+steps)>
            const keyContent = `${prompt}:${seed}:${style}:${width}:${height}:${steps}`;
            const promptHash = createHash('sha256').update(keyContent).digest('hex');
            const cacheKey = `preview:v1:${promptHash}`;

            // 2. Check Cache
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                // HIT
                await this.auditPreview(input, 'HIT', cacheKey);
                await this.recordCost(input, 0); // 0 cost for cache hit

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
            // Force strict preview params
            const previewInput: EngineInvokeInput = {
                ...input,
                payload: {
                    ...payload,
                    width,
                    height,
                    steps,
                    preview: true, // Signal to router/adapters
                    quality: 'preview',
                }
            };

            const result = await this.shotRenderRouter.invoke(previewInput);

            if (String(result.status) === 'SUCCESS' && result.output) {
                const output = result.output as any;

                // VALIDATION: No mock URLs allowed in REAL mode
                const url = output.url || output.assetUrl || '';
                if (url.includes('http://mock') || url.includes('https://mock')) {
                    throw new Error(`REAL_MODE_VIOLATION: Generated URL contains mock domain: ${url}`);
                }
                if (!url.startsWith('http') && !url.startsWith('file://')) {
                    // Warn? Or Fail? User said "Must be http(s):// or file:// or canonical"
                    // We throw for safety, but check empty first (already handled by router success check presumably)
                    throw new Error(`REAL_MODE_VIOLATION: Generated URL invalid schema: ${url}`);
                }

                // 4. Cache Result (TTL 7 days)
                await this.redisService.setJson(cacheKey, result.output, 7 * 24 * 3600);

                // Audit & Cost
                await this.auditPreview(input, 'MISS', cacheKey);
                await this.recordCost(input, 1); // 1 credit for generation
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

    private async auditPreview(input: EngineInvokeInput, type: 'HIT' | 'MISS', cacheKey: string) {
        try {
            await this.auditService.log({
                projectId: input.context.projectId,
                userId: input.context.userId,
                action: 'SHOT_PREVIEW',
                resourceId: cacheKey,
                details: {
                    cache: type,
                    engine: this.name,
                    traceId: input.context.traceId
                }
            });
        } catch (e) {
            this.logger.warn(`Audit failed: ${e}`);
        }
    }

    private async recordCost(input: EngineInvokeInput, amount: number) {
        try {
            await this.costLedgerService.recordFromEvent({
                projectId: input.context.projectId,
                jobId: input.context.jobId,
                traceId: input.context.traceId || 'unknown',
                engineKey: this.name,
                cost: amount,
                details: {
                    type: 'preview'
                }
            });
        } catch (e) {
            this.logger.warn(`Cost record failed: ${e}`);
        }
    }
}
