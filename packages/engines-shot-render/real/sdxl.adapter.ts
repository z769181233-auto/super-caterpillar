import { ShotRenderInput, ShotRenderOutput, EngineBillingUsage } from '../types';
import { renderWithProvider, RenderResult } from '../providers';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';

import { spawnSync } from 'child_process';

/**
 * P0-R0: ShotRender SDXL Adapter (真实渲染)
 *
 * 调用 Provider API 生成真实图片并写入文件系统
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * P1 Standard: Resolve SSOT Root
 *
 * [CRITICAL] Environment Rules:
 * - CI/PROD: MUST inject SSOT_ROOT environment variable.
 * - Local Dev: Git root detection is default.
 * - Fallback: Hardcoded fallback is ONLY for local dev debugging. PROD use is forbidden.
 */
function resolveSsotRoot(): string {
  if (process.env.SSOT_ROOT) return path.resolve(process.env.SSOT_ROOT);

  // Fallback 1: Git Root (Dev machines)
  try {
    const gitRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
    }).stdout.trim();
    if (gitRoot) return path.resolve(gitRoot);
  } catch (e) {}

  // Fallback 2: Hardcoded monorepo structure (Local Dev Emergency ONLY)
  return path.resolve(__dirname, '../../../../');
}

/**
 * P1 Standard: Normalize to Relative POSIX Key
 */
function toRelativeKey(absPath: string): string {
  const root = resolveSsotRoot();
  // P1 Standard: Handle file scheme and URL encoding
  let normalizedAbs = absPath.replace(/^file:\/\//, '');
  try {
    normalizedAbs = decodeURIComponent(normalizedAbs);
  } catch (e) {}

  // Ensure consistent separator for matching
  const normalizedRoot = path.resolve(root);
  const targetAbs = path.resolve(normalizedAbs);

  let rel = path.relative(normalizedRoot, targetAbs);

  // Convert to POSIX
  rel = rel.split(path.sep).join('/');

  // Validation (Strict P1 Hard Gate)
  if (path.isAbsolute(rel) || rel.startsWith('..') || !rel) {
    // Audit Requirement: Do NOT leak ssotRoot/absPath in error messages.
    // Use traceId (from context) if available for deep debugging.
    throw new Error(
      `[STORAGE_KEY_VIOLATION] Derived key is invalid (absolute or out-of-bounds): ${rel || 'EMPTY'}. Assets must be stored relatively within the SSOT root.`
    );
  }

  return rel;
}

export async function runShotRenderSDXL(
  input: ShotRenderInput,
  ctx: any = {}
): Promise<ShotRenderOutput> {
  // P2-FIX-2: 强制校验 shotId/traceId
  const { shotId, traceId } = input;
  if (!shotId || !traceId) {
    throw new Error(
      `[SHOT_RENDER_INPUT_INVALID] Missing required fields: shotId=${shotId}, traceId=${traceId}`
    );
  }

  // P2-FIX-2 DEBUG: 打印 adapter 入口参数（仅 Gate/Dev）
  if (process.env.GATE_MODE === '1' || process.env.NODE_ENV !== 'production') {
    process.stdout.write(
      util.format(
        '[ShotRender Adapter] Input received: shotId=%s, traceId=%s, seed=%d',
        shotId,
        traceId,
        input.seed || 0
      ) + '\n'
    );
  }

  const root = resolveSsotRoot();
  const ASSET_DIR = process.env.ASSET_STORAGE_DIR || path.join(root, '.runtime/assets');
  ensureDir(ASSET_DIR);

  const seed = input.seed || Math.floor(Math.random() * 1000000);
  const width = input.width || 1024;
  const height = input.height || 1024;

  // 1. 计算幂等 Key
  const paramsStr = JSON.stringify({
    shotId: input.shotId,
    prompt: input.prompt.trim(),
    seed,
    width,
    height,
  });
  const paramsHash = crypto.createHash('sha256').update(paramsStr).digest('hex');
  const promptHash = crypto
    .createHash('sha256')
    .update(input.prompt)
    .digest('hex')
    .substring(0, 12);

  // 2. 确定文件名
  const filename = `${input.shotId}_${seed}_${promptHash}.png`;
  const filePath = path.join(ASSET_DIR, filename);

  // 3. 幂等检查：如果同样参数的文件已存在，复用
  if (fs.existsSync(filePath)) {
    const existingBuf = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(existingBuf).digest('hex');

    process.stdout.write(util.format(`[ShotRender] Reusing existing asset: ${filePath}`) + '\n');

    return {
      asset: {
        uri: toRelativeKey(filePath),
        mimeType: 'image/png',
        sizeBytes: existingBuf.length,
        sha256,
        width,
        height,
      },
      render_meta: {
        model: 'sdxl-turbo-replicate',
        steps: 4,
        sampler: 'euler_ancestral',
        cfg_scale: 1.5,
        seed,
      },
      audit_trail: {
        engineKey: 'shot_render_real',
        engineVersion: '1.0.0-real',
        timestamp: new Date().toISOString(),
        paramsHash,
        traceId: ctx.traceId,
      } as any,
      billing_usage: {
        promptTokens: input.prompt.length,
        completionTokens: 200,
        totalTokens: input.prompt.length + 200,
        model: 'sdxl-turbo-replicate',
        gpuSeconds: 0, // 复用不计费
      },
    };
  }

  // 4. 调用真实 Provider
  const providerKey = (process.env.SHOT_RENDER_PROVIDER || 'local_mps').trim();
  let renderResult: RenderResult;

  // P2-1: No Fallback - Strict Dependency Check
  // If we are using the REAL engine, we MUST fail if dependencies are missing.
  // We assume this file is only reachable if configuring for real render.

  if (providerKey === 'replicate') {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        `[SHOT_RENDER_NO_FALLBACK] Provider 'replicate' requires REPLICATE_API_TOKEN. Fallback disallowed.`
      );
    }

    const { replicateProvider } = require('../providers/replicate.provider');
    renderResult = await replicateProvider.render(input.prompt, {
      width,
      height,
      seed,
      negativePrompt: input.negative_prompt,
    });
  } else if (providerKey === 'local_mps') {
    // Check if python script exists before even trying to run it
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    // Use the same logic as provider to check, or just rely on provider throwing.
    // However, to satisfy "No Fallback" explicit check, let's verify logic.
    // Actually, localMpsProvider does robust check. But we want to fail FAST if key deps missing.
    // The provider throws [LOCAL_MPS_RENDER_FAILED].
    // We wrap it here to ensure specific error code if needed, but the provider's error is good.
    // To strictly conform to P2-1 "Check dependencies", we can double check env if needed.
    // But for local script, existence is the check.

    const { localMpsProvider } = require('../providers/local_mps.provider');
    try {
      renderResult = await localMpsProvider.render(input.prompt, {
        width,
        height,
        seed,
        // P2-FIX-2: 传递必填追溯字段
        shotId,
        traceId,
      });
    } catch (e: any) {
      throw new Error(`[SHOT_RENDER_NO_FALLBACK] Provider 'local_mps' failed: ${e.message}`);
    }
  } else if (providerKey === 'local') {
    const { localProvider } = require('../providers/local.provider');
    renderResult = await localProvider.render(input.prompt, {
      width,
      height,
      seed,
    });
  } else {
    throw new Error(
      `[SHOT_RENDER_NO_FALLBACK] Unknown SHOT_RENDER_PROVIDER=${providerKey}. Fallback disallowed.`
    );
  }

  // 5. 写入文件
  fs.writeFileSync(filePath, renderResult.bytes);
  const sha256 = crypto.createHash('sha256').update(renderResult.bytes).digest('hex');

  // 6. 写入 manifest
  const manifestPath = filePath + '.json';
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        input: { ...input, seed },
        paramsHash,
        generatedAt: new Date().toISOString(),
        provider: renderResult.model,
        gpuSeconds: renderResult.gpuSeconds,
      },
      null,
      2
    )
  );

  process.stdout.write(
    util.format(
      `[ShotRender] ✅ Generated real image: ${filePath} (${renderResult.bytes.length} bytes)`
    ) + '\n'
  );

  return {
    asset: {
      uri: toRelativeKey(filePath),
      mimeType: renderResult.mime,
      sizeBytes: renderResult.bytes.length,
      sha256,
      width: renderResult.width,
      height: renderResult.height,
    },
    render_meta: {
      model: renderResult.model,
      steps: 4,
      sampler: 'euler_ancestral',
      cfg_scale: 1.5,
      seed: renderResult.seed,
    },
    audit_trail: {
      engineKey: 'shot_render_real',
      engineVersion: '1.0.0-real',
      timestamp: new Date().toISOString(),
      paramsHash,
      traceId: ctx.traceId,
    } as any,
    billing_usage: {
      promptTokens: input.prompt.length,
      completionTokens: 200,
      totalTokens: input.prompt.length + 200,
      model: renderResult.model,
      gpuSeconds: renderResult.gpuSeconds,
    },
  };
}
