import { Injectable, Logger } from '@nestjs/common';
import {
    EngineAdapter,
    EngineInvokeInput,
    EngineInvokeResult,
} from '@scu/shared-types';
import { ShotRenderReplicateAdapter } from './shot-render.replicate.adapter';
import { ShotRenderLocalAdapter } from './shot-render.local.adapter';
import { createHash } from 'crypto';

/**
 * Shot Render Router Adapter (Commercial Grade - Explicit Selection)
 * 
 * Phase 0-R: Production Video Seal
 * - Explicit provider selection (not relying on providers order)
 * - Env-based routing: SHOT_RENDER_PROVIDER (replicate | local)
 * - Default: replicate
 * - Audit trail includes: providerSelected, modelId, selectionReason
 * - No silent fallback to mock://
 */
@Injectable()
export class ShotRenderRouterAdapter implements EngineAdapter {
    public readonly name = 'shot_render_router';
    private readonly logger = new Logger(ShotRenderRouterAdapter.name);

    constructor(
        private readonly replicateAdapter: ShotRenderReplicateAdapter,
        private readonly localAdapter: ShotRenderLocalAdapter
    ) { }

    supports(engineKey: string): boolean {
        return (
            engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render'
        );
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        // 1. Explicit provider selection
        const provider = this.selectProvider();
        const adapter = this.getAdapter(provider);

        this.logger.log(`[ShotRenderRouter] Selected provider: ${provider.provider} (reason: ${provider.reason})`);

        // 2. Invoke selected adapter
        const result = await adapter.invoke(input);

        // 3. Enhance audit_trail with selection metadata
        if (result.status === 'SUCCESS' && result.output) {
            const enhancedAuditTrail = {
                ...(result.output as any).audit_trail,
                providerSelected: provider.provider,
                selectionReason: provider.reason,
                routedBy: this.name,
                prompt_hash: createHash('sha256').update(input.payload.enrichedPrompt || input.payload.prompt || '').digest('hex'),
            };

            (result.output as any).audit_trail = enhancedAuditTrail;
        }

        return result;
    }

    /**
     * Explicit provider selection logic (SSOT)
     * 
     * Priority:
     * 1. SHOT_RENDER_PROVIDER env var
     * 2. Default: replicate
     * 
     * No silent fallback to mock://
     */
    private selectProvider(): { provider: 'replicate' | 'local'; reason: string } {
        const envProvider = process.env.SHOT_RENDER_PROVIDER?.toLowerCase();

        // Explicit env override
        if (envProvider === 'replicate' || envProvider === 'local') {
            return {
                provider: envProvider as 'replicate' | 'local',
                reason: 'SHOT_RENDER_PROVIDER env var'
            };
        }

        // Check if Replicate token exists
        const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN?.trim();

        if (hasReplicateToken) {
            return {
                provider: 'replicate',
                reason: 'default (REPLICATE_API_TOKEN configured)'
            };
        }

        // Fallback to local ONLY if token missing
        this.logger.warn('[ShotRenderRouter] REPLICATE_API_TOKEN missing, falling back to local adapter');
        return {
            provider: 'local',
            reason: 'fallback (TOKEN_MISSING)'
        };
    }

    private getAdapter(provider: 'replicate' | 'local'): EngineAdapter {
        if (provider === 'replicate') {
            return this.replicateAdapter;
        } else {
            return this.localAdapter;
        }
    }
}
