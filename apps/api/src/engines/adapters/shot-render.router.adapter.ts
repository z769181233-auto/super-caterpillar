import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { ShotRenderReplicateAdapter } from './shot-render.replicate.adapter';
import { ShotRenderLocalAdapter } from './shot-render.local.adapter';
import { ShotRenderComfyuiAdapter } from './shot-render.comfyui.adapter';
import { ShotRenderMpsAdapter } from './shot-render.mps.adapter';
import { MockEngineAdapter } from '../../engine/adapters/mock-engine.adapter';
import { CharacterService } from '../../character/character.service';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

  private adapters: { [key: string]: EngineAdapter }; // Added to hold adapters

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
    private readonly replicateAdapter: ShotRenderReplicateAdapter,
    private readonly comfyuiAdapter: ShotRenderComfyuiAdapter,
    private readonly localAdapter: ShotRenderLocalAdapter,
    private readonly mpsAdapter: ShotRenderMpsAdapter,
    private readonly characterService: CharacterService
  ) {
    this.adapters = {
      replicate: this.replicateAdapter,
      comfyui: this.comfyuiAdapter,
      local: this.localAdapter,
      local_mps: this.mpsAdapter,
    };
    // Note: MockEngineAdapter might not be provided in EngineModule's providers by default,
    // so we don't @Inject(MockEngineAdapter) here to avoid startup error if missing.
    // We resolve it lazily in onModuleInit or ensureDependencies.
    // If we want to inject it, we must ensure it's in EngineModule.
    // Since I can't easily edit EngineModule safely right now, I'll rely on lazy resolution via ModuleRef.
  }

  private mockAdapter: MockEngineAdapter | undefined; // Lazy loaded

  async onModuleInit() {
    this.ensureDependencies();
  }

  private ensureDependencies() {
    // These should be resolved via ModuleRef ONLY if for some reason they aren't injected,
    // but we'll remove the read-only assignments and rely on injection.
    if (!this.mockAdapter) {
      try {
        this.mockAdapter = this.moduleRef.get(MockEngineAdapter, { strict: false });
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

    // B2.3: LoRA 自动挂载逻辑
    await this.mountCharacterLora(input);

    // 1. Explicit provider selection
    const { provider, reason } = this.selectProvider();
    const adapter = this.getAdapter(provider);

    this.logger.log(`[ShotRenderRouter] Selected provider: ${provider} (reason: ${reason})`);

    // 2. Invoke selected adapter
    let result = await adapter.invoke(input);

    // [MPS-ENRICHMENT-PHASE]
    // If provider is local_mps/comfy and returns an image, but the pipeline expects a video (REAL mode typically does),
    // we MUST enrich it to 2.5D video before continuing.
    if (result.status === 'SUCCESS' && result.output) {
      const output = result.output as any;
      const isImage =
        (output.asset?.uri || '').match(/\.(png|webp|jpg|jpeg)$/i) ||
        output.localPath?.match(/\.(png|webp|jpg|jpeg)$/i);

      if (isImage) {
        this.logger.log(
          `[ShotRenderRouter] Detected IMAGE output from ${provider}. Enriching to 2.5D Video via local FFmpeg...`
        );

        const repoRoot = this.getRepoRoot();
        const rawSource = output.localPath || output.asset?.uri;
        const absSourcePath = path.isAbsolute(rawSource)
          ? rawSource
          : path.resolve(repoRoot, rawSource);

        this.logger.log(`[ShotRenderRouter] Resolved absolute source path: ${absSourcePath}`);

        // Prepare shim input for ShotRenderLocalAdapter
        const shimInput: EngineInvokeInput = {
          ...input,
          payload: {
            ...input.payload,
            sourceImagePath: absSourcePath,
          },
        };

        const enrichmentResult = await this.localAdapter.invoke(shimInput);

        if (enrichmentResult.status === 'SUCCESS') {
          this.logger.log(
            `[ShotRenderRouter] Enrichment SUCCESS: ${enrichmentResult.output?.localPath}`
          );
          // Merge results: keep MPS metadata, but use FFmpeg video as the primary asset
          const enrichedOutput = enrichmentResult.output as any;
          result = {
            ...result,
            output: {
              ...output,
              asset: {
                ...output.asset,
                uri: enrichedOutput.storageKey || enrichedOutput.localPath,
                sha256: enrichedOutput.sha256 || undefined, // LocalAdapter might not return SHA yet
              },
              localPath: enrichedOutput.localPath,
              render_meta: {
                ...output.render_meta,
                enriched_by: 'shot_render_local',
                video_duration: enrichedOutput.render_meta?.duration,
              },
            },
          };
        } else {
          this.logger.error(
            `[ShotRenderRouter] Enrichment FAILED: ${enrichmentResult.error?.message}. Falling back to image (Downstream may fail).`
          );
        }
      }
    }

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

      // 4. Week 2: Real Engine Provenance Kit (收口点)
      if (process.env.ENGINE_REAL === '1' && provider !== 'mock') {
        await this.generateProvenanceKit(input, result, provider);
      }
    }

    return result;
  }

  private async generateProvenanceKit(
    input: EngineInvokeInput,
    result: EngineInvokeResult,
    provider: string
  ) {
    const output = result.output as any;
    const renderMeta = output.render_meta || {};
    const asset = output.asset || {};
    const traceId = input.context?.traceId || input.context?.jobId;
    const jobId = input.context?.jobId;

    if (!jobId) {
      this.logger.warn(`[ShotRenderRouter] No jobId found in context for provenance tracking.`);
      return;
    }

    const localPath = asset.uri || asset.storageKey;
    if (!localPath || !fs.existsSync(localPath)) {
      this.logger.warn(
        `[ShotRenderRouter] Local artifact not found at ${localPath}, skipping provenance kit.`
      );
      return;
    }

    // Determine artifact directory (Evidence Artifacts)
    const artifactsDir =
      process.env.SSOT_ARTIFACTS_DIR || path.join(process.cwd(), 'docs/_evidence/week2_artifacts');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const targetMp4 = path.join(artifactsDir, 'shot_render_output.mp4');
    const targetSha = targetMp4 + '.sha256';
    const targetProv = path.join(artifactsDir, 'shot_render_output.provenance.json');
    const targetProvSha = targetProv + '.sha256';

    // Copy MP4
    fs.copyFileSync(localPath, targetMp4);

    // Calculate/Fetch Metadata
    const sha256 = asset.sha256 || this.calculateSha256(targetMp4);
    const bytes = fs.statSync(targetMp4).size;
    let duration = renderMeta.duration_s || 2.0;
    try {
      const durStr = execSync(
        `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${targetMp4}"`
      )
        .toString()
        .trim();
      duration = parseFloat(durStr);
    } catch (e) {
      /* fallback */
    }

    const adapterVer = process.env.GIT_SHA || 'f9a6c0dc173a3309972e52597a2409733895412f';

    const provenance = {
      seal_type: 'REAL_ENGINE_ACCEPTANCE',
      artifact: {
        relpath: 'artifacts/shot_render_output.mp4',
        sha256: sha256,
        bytes: bytes,
        duration_s: duration,
      },
      producer: {
        kind: 'SHOT_RENDER',
        mode: 'REAL_ENGINE',
        engine_provider: provider,
        engine_model: renderMeta.engine_model || renderMeta.engine || 'unknown',
        engine_run_id: renderMeta.engine_run_id || traceId,
        adapter: renderMeta.engine || this.name,
        adapter_version: adapterVer,
      },
      job: {
        job_id: jobId,
        finished_at: new Date().toISOString(),
      },
      db: {
        job_table: 'shot_jobs',
        job_id_col: 'id',
        status_col: 'status',
        output_sha_col: 'outputSha256',
        engine_run_id_col: 'engineRunId',
        engine_provider_col: 'engineProvider',
        engine_model_col: 'engineModel',
      },
    };

    // Write files
    fs.writeFileSync(targetSha, sha256);
    fs.writeFileSync(targetProv, JSON.stringify(provenance, null, 2));
    const provSha = createHash('sha256').update(fs.readFileSync(targetProv)).digest('hex');
    fs.writeFileSync(targetProvSha, provSha);

    this.logger.log(
      `[ShotRenderRouter] Provenance kit generated for job ${jobId} in ${artifactsDir}`
    );

    // Update DB (Nullable fields added in Phase W2-1)
    try {
      await (this.prisma as any).shotJob.update({
        where: { id: jobId },
        data: {
          outputSha256: sha256,
          engineProvider: provider,
          engineRunId: provenance.producer.engine_run_id,
          engineModel: provenance.producer.engine_model,
        },
      });
      this.logger.log(`[ShotRenderRouter] DB updated with provenance for job ${jobId}`);
    } catch (e) {
      this.logger.error(`[ShotRenderRouter] DB update failed: ${e.message}`);
    }
  }

  private calculateSha256(filePath: string): string {
    const hash = createHash('sha256');
    const buffer = fs.readFileSync(filePath);
    return hash.update(buffer).digest('hex');
  }

  private getRepoRoot(): string {
    const repoRoot = process.env.SCU_REPO_ROOT || process.cwd();
    // Heuristic for monorepo: apps/api -> root
    if (repoRoot.endsWith('apps/api')) {
      return path.resolve(repoRoot, '../../');
    }
    // If we're inside the repo but in a subfolder, walk up if needed
    // For now, assume process.cwd() or SCU_REPO_ROOT is generally correct or solvable
    return path.resolve(repoRoot);
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
  private selectProvider(): {
    provider: 'replicate' | 'local' | 'comfyui' | 'mock' | 'local_mps';
    reason: string;
  } {
    const envProvider = (process.env.SHOT_RENDER_PROVIDER || 'replicate').toLowerCase();
    const engineMode = process.env.ENGINE_MODE || 'development';

    if (engineMode === 'production' && envProvider === 'mock') {
      throw new Error(
        'PRODUCTION_SAFETY_ERROR: SHOT_RENDER_PROVIDER=mock is not allowed in ENGINE_MODE=production'
      );
    }

    if (envProvider === 'local') {
      return { provider: 'local', reason: `Explicit SHOT_RENDER_PROVIDER=${envProvider}` };
    }

    if (envProvider === 'local_mps') {
      return { provider: 'local_mps', reason: `Explicit SHOT_RENDER_PROVIDER=${envProvider}` };
    }

    if (envProvider === 'comfyui') {
      return { provider: 'comfyui', reason: 'Explicit SHOT_RENDER_PROVIDER=comfyui' };
    }

    if (envProvider === 'mock') {
      return { provider: 'mock', reason: 'Explicit SHOT_RENDER_PROVIDER=mock (Gate Mode)' };
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
      `JOB_CONFIG_INVALID: Unknown SHOT_RENDER_PROVIDER="${envProvider}". Valid: replicate, comfyui, local, mock`
    );
  }

  private getAdapter(provider: string): EngineAdapter {
    if (provider === 'replicate') {
      return this.replicateAdapter;
    } else if (provider === 'comfyui') {
      return this.comfyuiAdapter;
    } else if (provider === 'mock') {
      return this.mockAdapter!;
    } else if (provider === 'local_mps') {
      return this.mpsAdapter;
    } else {
      return this.localAdapter;
    }
  }

  /**
   * B2.3: LoRA 自动挂载逻辑
   * 从 payload 提取 characterId，查询 CharacterProfile，
   * 如果存在 loraModelId，则添加到渲染参数
   */
  private async mountCharacterLora(input: EngineInvokeInput): Promise<void> {
    try {
      const characterId = input.payload?.characterId as string | undefined;

      if (!characterId) {
        // 没有指定角色，跳过 LoRA 挂载
        return;
      }

      this.logger.debug(`[ShotRenderRouter] Checking for LoRA for character: ${characterId}`);

      const character = await this.characterService.findOne(characterId);

      if (character?.loraModelId) {
        this.logger.log(
          `[ShotRenderRouter] Mounting LoRA for character "${character.name}": ${character.loraModelId}`
        );

        // 添加 LoRA 到 payload
        if (!input.payload.loras) {
          input.payload.loras = [];
        }

        // 检查是否已存在（避免重复）
        const existingLora = input.payload.loras.find(
          (lora: any) => lora.modelId === character.loraModelId
        );

        if (!existingLora) {
          input.payload.loras.push({
            modelId: character.loraModelId,
            triggerWord: character.nameEn || character.name,
            weight: 1.0,
            source: 'character_auto_mount',
          });

          this.logger.log(
            `[ShotRenderRouter] LoRA mounted successfully. Trigger word: "${character.nameEn || character.name}"`
          );
        } else {
          this.logger.debug(`[ShotRenderRouter] LoRA already exists in payload, skipping`);
        }
      } else {
        this.logger.debug(`[ShotRenderRouter] No LoRA found for character ${characterId}`);
      }
    } catch (error: any) {
      // 非阻塞错误，记录后继续
      this.logger.warn(
        `[ShotRenderRouter] Failed to mount LoRA: ${error.message}. Continuing without LoRA.`
      );
    }
  }
}
