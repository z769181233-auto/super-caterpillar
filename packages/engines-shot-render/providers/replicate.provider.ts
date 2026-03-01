/**
 * P0-R0: Replicate SDXL Turbo Provider
 *
 * 调用 Replicate API 进行真实图片渲染
 * 环境变量: REPLICATE_API_TOKEN (必须)
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface RenderResult {
  bytes: Buffer;
  mime: 'image/png' | 'image/webp';
  width: number;
  height: number;
  seed: number;
  model: string;
  gpuSeconds: number;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
  metrics?: { predict_time?: number };
}

const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// SDXL Turbo model on Replicate
// Using stability-ai/sdxl:39ed... as default base
const SDXL_MODEL_VERSION = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

function getApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  // 强制校验 token 存在
  if (!token || token.trim().length === 0) {
    throw new Error('[RENDER_ERROR] REPLICATE_API_TOKEN is required but not set');
  }
  return token;
}

async function httpRequest(
  url: string,
  options: https.RequestOptions,
  body?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          // 安全过滤：避免打印 token
          let safeData = data;
          try {
            const json = JSON.parse(data);
            // 只保留错误相关字段
            safeData = JSON.stringify({
              status: res.statusCode,
              title: json.title,
              detail: json.detail,
              type: json.type,
            });
          } catch (e) {
            // 非 JSON 响应，截断以防过长
            safeData = data.substring(0, 200);
          }

          if (res.statusCode === 401) {
            reject(
              new Error(
                `[AUTH_ERROR] HTTP 401: Invalid or missing Replicate token. Details: ${safeData}`
              )
            );
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${safeData}`));
          }
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    protocol
      .get(url, (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function pollPrediction(
  id: string,
  token: string,
  maxRetries = 60
): Promise<ReplicatePrediction> {
  const url = `${REPLICATE_API_URL}/${id}`;
  for (let i = 0; i < maxRetries; i++) {
    const response = await httpRequest(url, {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
      },
    });
    const prediction: ReplicatePrediction = JSON.parse(response);

    if (prediction.status === 'succeeded') {
      return prediction;
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
    }

    // Wait 1 second before polling again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Prediction timeout');
}

export async function renderWithReplicate(
  prompt: string,
  options: {
    width?: number;
    height?: number;
    seed?: number;
    negativePrompt?: string;
    steps?: number;
  } = {}
): Promise<RenderResult> {
  const token = getApiToken();

  // [GATE] Test Bypass for CI/Gate environments
  if (token.startsWith('TEST_BYPASS_')) {
    // Stage D: Gate Policy - Hard constraint
    if (process.env.GATE_MODE !== '1' && process.env.ALLOW_TEST_BYPASS !== '1') {
      throw new Error(
        '[SECURITY] TEST_BYPASS_GATE token is ONLY allowed in GATE_MODE=1 or ALLOW_TEST_BYPASS=1'
      );
    }
    if (process.env.PRODUCTION_MODE === '1' && process.env.ALLOW_TEST_BYPASS !== '1') {
      throw new Error('[SECURITY] TEST_BYPASS_GATE strictly forbidden in PRODUCTION_MODE=1');
    }
    console.warn(`[AUDIT] 🚨 USING ${token} (Mock Result) 🚨 - This is NOT a real inference.`);

    console.log('[Replicate] Using TEST_BYPASS mode. Skipping API call.');
    // Create a simple 1x1 black PNG
    const dummyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
      'base64'
    );
    return {
      bytes: dummyPng,
      mime: 'image/png',
      width: options.width || 1024,
      height: options.height || 1024,
      seed: options.seed || 12345,
      model: 'test-bypass-sdxl',
      gpuSeconds: 0.1,
    };
  }

  const width = options.width || 1024;
  const height = options.height || 1024;
  const seed = options.seed || Math.floor(Math.random() * 1000000);
  const steps = options.steps || 4; // SDXL Turbo uses 4 steps

  const input = {
    prompt,
    negative_prompt: options.negativePrompt || '',
    width,
    height,
    num_inference_steps: steps,
    seed,
  };

  // Create prediction
  const createBody = JSON.stringify({
    version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    input,
  });

  const createResponse = await httpRequest(
    REPLICATE_API_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createBody),
      },
    },
    createBody
  );

  const prediction: ReplicatePrediction = JSON.parse(createResponse);

  // Poll for completion
  const result = await pollPrediction(prediction.id, token);

  if (!result.output || result.output.length === 0) {
    throw new Error('No output from Replicate');
  }

  // Download the image
  const imageUrl = result.output[0];
  const imageBuffer = await downloadImage(imageUrl);

  // Determine mime type from buffer magic bytes
  const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
  const mime: 'image/png' | 'image/webp' = isPng ? 'image/png' : 'image/webp';

  return {
    bytes: imageBuffer,
    mime,
    width,
    height,
    seed,
    model: 'sdxl-turbo-replicate',
    gpuSeconds: result.metrics?.predict_time || 2.5,
  };
}

/**
 * Provider 接口实现
 */
export const replicateProvider = {
  key: 'replicate' as const,
  async render(
    prompt: string,
    options?: {
      width?: number;
      height?: number;
      seed?: number;
      negativePrompt?: string;
    }
  ): Promise<RenderResult> {
    return renderWithReplicate(prompt, options);
  },
};
