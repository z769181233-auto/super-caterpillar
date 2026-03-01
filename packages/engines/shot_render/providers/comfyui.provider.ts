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

export interface LoraConfig {
  modelId: string;
  weightModel: number;
  weightClip: number;
}

export interface ComfyUIOptions {
  width?: number;
  height?: number;
  seed?: number;
  checkpoint?: string;
  loras?: LoraConfig[];
  negativePrompt?: string;
  samplerName?: string;
  steps?: number;
  cfg?: number;
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

/**
 * Dynamic ComfyUI Graph Builder
 * Injects LoRA nodes between CheckpointLoader and CLIP/KSampler if needed.
 */
function buildGraph(promptText: string, options: ComfyUIOptions, template: any) {
  const graph = JSON.parse(JSON.stringify(template));
  const seed = options.seed || Math.floor(Math.random() * 1000000000);

  // 1. Basic Params
  if (graph['3']) {
    // KSampler
    graph['3'].inputs.seed = seed;
    graph['3'].inputs.steps = options.steps || 20;
    graph['3'].inputs.cfg = options.cfg || 7;
    if (options.samplerName) graph['3'].inputs.sampler_name = options.samplerName;
  }
  if (graph['6']) graph['6'].inputs.text = promptText; // Positive
  if (graph['7'])
    graph['7'].inputs.text = options.negativePrompt || 'text, watermark, blurry, low quality'; // Negative
  if (graph['5']) {
    // Latent
    graph['5'].inputs.width = options.width || 1024;
    graph['5'].inputs.height = options.height || 1024;
  }
  if (graph['4'] && options.checkpoint) {
    // Checkpoint
    graph['4'].inputs.ckpt_name = options.checkpoint;
  }

  // 2. Dynamic LoRA Injection
  // We need to chain LoRA nodes.
  // Original path: Checkpoint(4) -> KSampler(3).model + CLIP(CLIPLoader 10 or Checkpoint 4) -> CLIPTextEncode(6,7)

  if (options.loras && options.loras.length > 0) {
    let lastModelNode = '4';
    let lastClipNode = '10'; // In sdxl template, CLIP comes from Node 10 or 4

    options.loras.forEach((lora, index) => {
      const loraNodeId = `lora_${index}`;
      graph[loraNodeId] = {
        inputs: {
          lora_name: lora.modelId,
          strength_model: lora.weightModel || 1.0,
          strength_clip: lora.weightClip || 1.0,
          model: [lastModelNode, 0],
          clip: [lastClipNode, 0],
        },
        class_type: 'LoraLoader',
        _meta: { title: `LoRA ${lora.modelId}` },
      };
      lastModelNode = loraNodeId;
      lastClipNode = loraNodeId;
    });

    // Remap KSampler and CLIPTextEncode to the last LoRA node
    if (graph['3']) graph['3'].inputs.model = [lastModelNode, 0];
    if (graph['6']) graph['6'].inputs.clip = [lastClipNode, 0];
    if (graph['7']) graph['7'].inputs.clip = [lastClipNode, 0];
  }

  return graph;
}

export async function renderWithComfyUI(
  promptText: string,
  options: ComfyUIOptions = {}
): Promise<RenderResult> {
  const seed = options.seed || Math.floor(Math.random() * 1000000000);

  // 1. Load Template
  const templateName = 'comfyui_text2img_sdxl.json';
  const candidates = [
    path.join(__dirname, 'templates', templateName),
    path.join(process.cwd(), 'packages/engines/shot_render/providers/templates', templateName),
  ];

  let templatePath = '';
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      templatePath = p;
      break;
    }
  }

  if (!templatePath) throw new Error(`ComfyUI template not found.`);
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

  // 2. Build Dynamic Graph
  const prompt = buildGraph(promptText, options, template);

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

  const queueData = JSON.parse(queueRes);
  const promptId = queueData.prompt_id;
  if (!promptId) throw new Error('Failed to queue prompt to ComfyUI');

  // 4. Poll History
  let history: any = null;
  const startTime = Date.now();
  for (let i = 0; i < 60; i++) {
    const historyRes = await httpRequest(`${COMFYUI_BASE_URL}/history/${promptId}`, {
      method: 'GET',
    });
    const historyData = JSON.parse(historyRes);
    if (historyData[promptId] && historyData[promptId].status.completed) {
      history = historyData[promptId];
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!history) throw new Error('ComfyUI generation timed out');

  // 5. Get Images (Assuming Node 9 is SaveImage)
  const outputs = history.outputs['9'];
  if (!outputs || !outputs.images || outputs.images.length === 0) {
    throw new Error('No output image found');
  }

  const imageBuffers: Buffer[] = [];
  for (const img of outputs.images) {
    const buffer = await downloadImage(img.filename, img.subfolder, img.type);
    imageBuffers.push(buffer);
  }

  return {
    bytes: imageBuffers[0],
    images: imageBuffers,
    mime: 'image/png',
    width: options.width || 1024,
    height: options.height || 1024,
    seed,
    model: options.checkpoint || 'sdxl-turbo-comfyui',
    gpuSeconds: (Date.now() - startTime) / 1000,
  };
}

export const comfyuiProvider = {
  key: 'comfyui' as const,
  async render(prompt: string, options?: ComfyUIOptions): Promise<RenderResult> {
    return renderWithComfyUI(prompt, options);
  },
};
