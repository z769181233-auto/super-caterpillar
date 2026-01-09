import { ShotRenderInput, ShotRenderOutput, EngineBillingUsage } from '../types';
import { renderWithProvider, RenderResult } from '../providers';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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

export async function runShotRenderSDXL(
  input: ShotRenderInput,
  ctx: any = {}
): Promise<ShotRenderOutput> {
  const ASSET_DIR = process.env.ASSET_STORAGE_DIR || path.join(process.cwd(), 'apps/workers/.runtime/assets');
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
  const promptHash = crypto.createHash('sha256').update(input.prompt).digest('hex').substring(0, 12);

  // 2. 确定文件名
  const filename = `${input.shotId}_${seed}_${promptHash}.png`;
  const filePath = path.join(ASSET_DIR, filename);

  // 3. 幂等检查：如果同样参数的文件已存在，复用
  if (fs.existsSync(filePath)) {
    const existingBuf = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(existingBuf).digest('hex');

    console.log(`[ShotRender] Reusing existing asset: ${filePath}`);

    return {
      asset: {
        uri: filePath,
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
  console.log(`[ShotRender] Calling real provider for: ${input.shotId}`);
  const renderResult: RenderResult = await renderWithProvider(input.prompt, {
    width,
    height,
    seed,
    negativePrompt: input.negative_prompt,
  });

  // 5. 写入文件
  fs.writeFileSync(filePath, renderResult.bytes);
  const sha256 = crypto.createHash('sha256').update(renderResult.bytes).digest('hex');

  // 6. 写入 manifest
  const manifestPath = filePath + '.json';
  fs.writeFileSync(manifestPath, JSON.stringify({
    input: { ...input, seed },
    paramsHash,
    generatedAt: new Date().toISOString(),
    provider: renderResult.model,
    gpuSeconds: renderResult.gpuSeconds,
  }, null, 2));

  console.log(`[ShotRender] ✅ Generated real image: ${filePath} (${renderResult.bytes.length} bytes)`);

  return {
    asset: {
      uri: filePath,
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
