/**
 * P0-R0: ComfyUI Local Provider (HTTP Polling)
 *
 * 调用本地 ComfyUI API 进行真实图片渲染
 * 环境变量: COMFYUI_BASE_URL (默认 http://127.0.0.1:8188)
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface RenderResult {
  bytes: Buffer;
  images?: Buffer[];
  mime: 'image/png' | 'image/webp';
  width: number;
  height: number;
  seed: number;
  model: string;
  gpuSeconds: number;
}

export interface ComfyUIResponse {
  prompt_id: string;
  number: number;
  node_errors: any;
}

export interface ComfyUIHistory {
  [prompt_id: string]: {
    outputs: {
      [node_id: string]: {
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
        // Text/JSON output support
        text?: string[];
        json?: any[];
      };
    };
    status: {
      status_str: 'success' | 'failed';
      completed: boolean;
      messages: any[];
    };
  };
}

export const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';

export async function httpRequest(
  url: string,
  options: http.RequestOptions,
  body?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

async function downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
  const url = `${COMFYUI_BASE_URL}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

export async function renderWithComfyUI(
  promptText: string,
  options: {
    width?: number;
    height?: number;
    seed?: number;
    templateName?: string;
  } = {}
): Promise<RenderResult> {
  const seed = options.seed || Math.floor(Math.random() * 1000000000);

  // 1. Load Template
  const templateName = options.templateName || 'comfyui_text2img_sdxl.json';
  const candidates = [
    path.join(__dirname, 'templates', templateName),
    // Fallback for Monorepo execution (Worker -> Packages)
    path.join(
      process.cwd(),
      '../../packages/engines/shot_render/providers/templates',
      templateName
    ),
    // Fallback for API execution
    path.join(process.cwd(), 'packages/engines/shot_render/providers/templates', templateName),
    // Absolute path fallback
    '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/packages/engines/shot_render/providers/templates/comfyui_text2img_sdxl.json',
  ];

  let templatePath = '';
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      templatePath = p;
      break;
    }
  }

  if (!templatePath) {
    throw new Error(`ComfyUI template not found. Searched: ${candidates.join(', ')}`);
  }
  const prompt = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

  // 2. Inject Params
  // Node 3: KSampler (seed)
  if (prompt['3'] && prompt['3'].inputs) {
    prompt['3'].inputs.seed = seed;
  }
  // Node 6: CLIPTextEncode (Positive Prompt)
  if (prompt['6'] && prompt['6'].inputs) {
    prompt['6'].inputs.text = promptText;
  }
  // Node 5: EmptyLatentImage (Width/Height)
  if (prompt['5'] && prompt['5'].inputs) {
    prompt['5'].inputs.width = options.width || 1024;
    prompt['5'].inputs.height = options.height || 1024;
  }

  // 3. Queue Prompt
  const promptBody = JSON.stringify({ prompt });
  const queueRes = await httpRequest(
    `${COMFYUI_BASE_URL}/prompt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(promptBody),
      },
    },
    promptBody
  );

  const queueData: ComfyUIResponse = JSON.parse(queueRes);
  const promptId = queueData.prompt_id;

  if (!promptId) {
    throw new Error('Failed to queue prompt to ComfyUI');
  }

  // 4. Poll History (Max 60s)
  let history: ComfyUIHistory[string] | null = null;
  const startTime = Date.now();

  for (let i = 0; i < 60; i++) {
    try {
      const historyRes = await httpRequest(`${COMFYUI_BASE_URL}/history/${promptId}`, {
        method: 'GET',
      });
      const historyData: ComfyUIHistory = JSON.parse(historyRes);

      if (historyData[promptId] && historyData[promptId].status.completed) {
        history = historyData[promptId];
        break;
      }
    } catch (e) {
      // Ignore poll errors
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!history) {
    throw new Error('ComfyUI generation timed out');
  }

  // 5. Get Images
  // Find "Save Image" node output (Node 9)
  const outputs = history.outputs['9'];
  if (!outputs || !outputs.images || outputs.images.length === 0) {
    throw new Error('No output image found in ComfyUI history');
  }

  const imageBuffers: Buffer[] = [];
  for (const outputImage of outputs.images) {
    const buffer = await downloadImage(
      outputImage.filename,
      outputImage.subfolder,
      outputImage.type
    );
    imageBuffers.push(buffer);
  }

  return {
    bytes: imageBuffers[0],
    images: imageBuffers,
    mime: 'image/png',
    width: options.width || 1024,
    height: options.height || 1024,
    seed,
    model: 'sdxl-turbo-comfyui',
    gpuSeconds: (Date.now() - startTime) / 1000,
  };
}

export const comfyuiProvider = {
  key: 'comfyui' as const,
  async render(
    prompt: string,
    options?: {
      width?: number;
      height?: number;
      seed?: number;
    }
  ): Promise<RenderResult> {
    return renderWithComfyUI(prompt, options);
  },
};
