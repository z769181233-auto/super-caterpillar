import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { ShotRenderReplicateAdapter } from './shot-render.replicate.adapter';
import { ShotRenderLocalAdapter } from './shot-render.local.adapter';
import { ShotRenderComfyuiAdapter } from './shot-render.comfyui.adapter';
import { createHash } from 'crypto';

/**
 * Shot Render Router Adapter (Commercial Grade - Explicit Selection)
 *
 * Phase 0-R: Production Video Seal
 * - Explicit provider selection (not relying on providers order)
 * - Env-based routing: SHOT_RENDER_PROVIDER (replicate | comfyui | local)
 * - Default: replicate
 * - Audit trail includes: providerSelected, modelId, selectionReason
 * - No silent fallback to mock://
 */
@Injectable()
export class ShotRenderRouterAdapter implements EngineAdapter, OnModuleInit {
  public readonly name = 'shot_render_router';
  private readonly logger = new Logger(ShotRenderRouterAdapter.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(ShotRenderReplicateAdapter)
    private replicateAdapter: ShotRenderReplicateAdapter,
    @Inject(ShotRenderLocalAdapter)
    private localAdapter: ShotRenderLocalAdapter,
    @Inject(ShotRenderComfyuiAdapter)
    private comfyuiAdapter: ShotRenderComfyuiAdapter
  ) {}

  async onModuleInit() {
    this.ensureDependencies();
  }

  private ensureDependencies() {
    if (!this.replicateAdapter) {
      try {
        this.replicateAdapter = this.moduleRef.get(ShotRenderReplicateAdapter, { strict: false });
      } catch (e) {
        /* silent fail */
      }
    }
    if (!this.localAdapter) {
      try {
        this.localAdapter = this.moduleRef.get(ShotRenderLocalAdapter, { strict: false });
      } catch (e) {
        /* silent fail */
      }
    }
    if (!this.comfyuiAdapter) {
      try {
        this.comfyuiAdapter = this.moduleRef.get(ShotRenderComfyuiAdapter, { strict: false });
      } catch (e) {
        /* silent fail */
      }
    }
  }

  supports(engineKey: string): boolean {
    return (
      engineKey === 'shot_render' ||
      engineKey === 'default_shot_render' ||
      engineKey === 'real_shot_render'
    );
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.ensureDependencies();
    // 1. Explicit provider selection
    const { provider, reason } = this.selectProvider();
    const adapter = this.getAdapter(provider);

    this.logger.log(`[ShotRenderRouter] Selected provider: ${provider} (reason: ${reason})`);

    // 2. Invoke selected adapter
    const result = await adapter.invoke(input);

    // 3. Enhance audit_trail with selection metadata
    if (result.status === 'SUCCESS' && result.output) {
      const output = result.output as any;
      const prompt = input.payload.enrichedPrompt || input.payload.prompt || '';

      output.audit_trail = {
        ...output.audit_trail,
        providerSelected: provider,
        selectionReason: reason,
        routedBy: this.name,
        prompt_hash: createHash('sha256').update(prompt).digest('hex'),
        pricing_key: provider === 'replicate' ? 'REPLICATE_SDXL' : 'LOCAL_FREE',
      };
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
   * NO SILENT FALLBACK: If replicate selected but token missing, THROW.
   */
  private selectProvider(): { provider: 'replicate' | 'local' | 'comfyui'; reason: string } {
    const envProvider = (process.env.SHOT_RENDER_PROVIDER || 'replicate').toLowerCase();

    if (envProvider === 'local' || envProvider === 'local_mps') {
      return { provider: 'local', reason: `Explicit SHOT_RENDER_PROVIDER=${envProvider}` };
    }

    if (envProvider === 'comfyui') {
      return { provider: 'comfyui', reason: 'Explicit SHOT_RENDER_PROVIDER=comfyui' };
    }

    if (envProvider === 'replicate') {
      if (!process.env.REPLICATE_API_TOKEN?.trim()) {
        throw new Error(
          'JOB_CONFIG_INVALID: REPLICATE_API_TOKEN missing while SHOT_RENDER_PROVIDER=replicate. Production forbids silent fallback to mock/demo.'
        );
      }
      return { provider: 'replicate', reason: 'Default/Explicit SHOT_RENDER_PROVIDER=replicate' };
    }

    throw new Error(
      `JOB_CONFIG_INVALID: Unknown SHOT_RENDER_PROVIDER="${envProvider}". Valid: replicate, comfyui, local`
    );
  }

  private getAdapter(provider: string): EngineAdapter {
    if (provider === 'replicate') {
      return this.replicateAdapter;
    } else if (provider === 'comfyui') {
      return this.comfyuiAdapter;
    } else {
      return this.localAdapter;
    }
  }
}
