import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { ppv64FromImage, ppv64Similarity } from '../../../../../packages/shared/vision/ppv64';
import { promises as fsp } from 'fs';
import { safeJoin } from '../../../../../packages/shared/fs_safe';
import { sha256File } from '../../../../../packages/shared/hash';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * CE23 Identity Consistency Adapter - Industrial Grade (P15-0 PPV-64)
 * - 0 Sync IO (Async Only)
 * - Path Traversal Protection (safeJoin)
 * - Deterministic Binary Embedding Hash
 * - Configurable Threshold from Env
 */
@Injectable()
export class CE23IdentityLocalAdapter implements EngineAdapter {
  public readonly name = 'ce23_identity_consistency';
  private readonly logger = new Logger(CE23IdentityLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'ce23_identity_consistency';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { anchorImageKey, targetImageKey, characterId } = input.payload as any;
    const traceId = input.context?.traceId || 'unknown';
    const t0 = performance.now();

    this.logger.log(`[CE23_ADAPTER] Scoring ${characterId} for traceId=${traceId}`);

    try {
      // 1. Resolve physical paths (Safe Join)
      const storageRoot = process.env.STORAGE_ROOT || '.runtime';
      const anchorPath = safeJoin(storageRoot, anchorImageKey);
      const targetPath = safeJoin(storageRoot, targetImageKey);

      // 2. Async Check existence
      const [anchorExists, targetExists] = await Promise.all([
        fsp
          .access(anchorPath)
          .then(() => true)
          .catch(() => false),
        fsp
          .access(targetPath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (!anchorExists) throw new Error(`ANCHOR_NOT_FOUND: ${anchorImageKey}`);
      if (!targetExists) throw new Error(`TARGET_NOT_FOUND: ${targetImageKey}`);

      // 3. Extract PPV-64 vectors (sharp async)
      const [vecAnchor, vecTarget] = await Promise.all([
        ppv64FromImage(anchorPath),
        ppv64FromImage(targetPath),
      ]);

      // 4. Compute Similarity (Deterministic Clamp)
      const score = ppv64Similarity(vecAnchor, vecTarget);

      // 5. Evidence Generation (Stream Hash + Binary Embedding Hash)
      const [anchorHash, targetHash] = await Promise.all([
        sha256File(anchorPath),
        sha256File(targetPath),
      ]);

      // Deterministic Binary Embedding Hash (Float32Array)
      const floatArray = new Float32Array(vecTarget);
      const embeddingHash = createHash('sha256')
        .update(Buffer.from(floatArray.buffer))
        .digest('hex');

      const threshold = parseFloat(process.env.CE23_THRESHOLD || '0.92');

      const output = {
        identity_score: score,
        threshold_config: threshold,
        is_consistent: score >= threshold,
        provider: 'real-ppv64-v1',
        embedding_hash: embeddingHash,
        details: {
          anchor_sha256: anchorHash,
          target_sha256: targetHash,
          algo: 'ppv64_v1',
          dims: 64,
          score_mapping: 'cosine_normalized_0_1',
        },
      };

      const t1 = performance.now();

      return {
        status: EngineInvokeStatus.SUCCESS,
        output,
        metrics: {
          durationMs: Math.round(t1 - t0),
        },
      };
    } catch (error: any) {
      this.logger.error(`[CE23_ADAPTER] Failed: ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          code: 'CE23_ADAPTER_FAIL',
          message: error.message,
        },
      };
    }
  }
}
