import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface ComfyUIConfig {
  baseUrl: string;
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
      };
    };
    status: {
      status_str: 'success' | 'failed';
      completed: boolean;
    };
  };
}

export class ComfyUIClient {
  private baseUrl: string;

  constructor(config?: ComfyUIConfig) {
    this.baseUrl = config?.baseUrl || process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';
  }

  private async httpRequest(
    url: string,
    options: http.RequestOptions,
    body?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      const req = http.request(fullUrl, options, (res) => {
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

  async queuePrompt(prompt: any): Promise<string> {
    const body = JSON.stringify({ prompt });
    const res = await this.httpRequest(
      '/prompt',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      body
    );
    const data: ComfyUIResponse = JSON.parse(res);
    return data.prompt_id;
  }

  async waitCompletion(promptId: string, timeoutSec = 120): Promise<any> {
    for (let i = 0; i < timeoutSec; i++) {
      const res = await this.httpRequest(`/history/${promptId}`, {
        method: 'GET',
      });
      const history: ComfyUIHistory = JSON.parse(res);
      if (history[promptId]) {
        if (history[promptId].status.completed) {
          if (history[promptId].status.status_str === 'failed') {
            throw new Error(`ComfyUI Prompt Failed: ${promptId}`);
          }
          return history[promptId];
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`ComfyUI Timeout: ${promptId}`);
  }

  async downloadView(filename: string, subfolder: string, type: string): Promise<Buffer> {
    const url = `${this.baseUrl}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
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

  async generateImage(prompt: any, outputNodeId = '9'): Promise<Buffer> {
    const promptId = await this.queuePrompt(prompt);
    const history = await this.waitCompletion(promptId);
    const output = history.outputs[outputNodeId];
    if (!output || !output.images || output.images.length === 0) {
      throw new Error(`No images found in output node ${outputNodeId}`);
    }
    const imgInfo = output.images[0];
    return await this.downloadView(imgInfo.filename, imgInfo.subfolder, imgInfo.type);
  }
}

export const defaultComfyUIClient = new ComfyUIClient();
