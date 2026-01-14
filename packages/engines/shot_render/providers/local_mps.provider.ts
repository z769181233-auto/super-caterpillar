import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface RenderResult {
  bytes: Buffer;
  mime: 'image/png' | 'image/webp';
  width: number;
  height: number;
  seed: number;
  model: string;
  gpuSeconds: number;
  asset_path?: string;
  sha256?: string;
}

function sha256(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export const localMpsProvider = {
  key: 'local_mps' as const,
  async render(
    prompt: string,
    options?: { width?: number; height?: number; seed?: number }
  ): Promise<RenderResult> {
    const width = options?.width ?? 768;
    const height = options?.height ?? 768;
    const seed = options?.seed ?? 42;

    const outDir =
      process.env.ASSET_STORAGE_DIR ||
      path.join(process.cwd(), 'apps/workers/.runtime/assets_gate_p0r0');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, `shot_render_local_${Date.now()}_${seed}.png`);
    const pythonBin = process.env.PYTHON_BIN || 'python3';

    // P0 Fix: Robust script path detection by walking up
    let currentDir = __dirname;
    let scriptPath = '';
    while (currentDir !== path.dirname(currentDir)) {
      const target = path.join(currentDir, 'tools/local_render/sd15_mps.py');
      if (fs.existsSync(target)) {
        scriptPath = target;
        break;
      }
      currentDir = path.dirname(currentDir);
    }
    if (!scriptPath) scriptPath = 'tools/local_render/sd15_mps.py'; // Fallback

    const py = spawnSync(
      pythonBin,
      [
        scriptPath,
        '--out',
        outPath,
        '--prompt',
        prompt,
        '--w',
        String(width),
        '--h',
        String(height),
        '--seed',
        String(seed),
      ],
      { encoding: 'utf-8' }
    );

    if (py.status !== 0) {
      const err = (py.stderr || py.stdout || '').slice(0, 4000);
      throw new Error(`[LOCAL_MPS_RENDER_FAILED] exit=${py.status} ${err}`);
    }

    try {
      const meta = JSON.parse(py.stdout.trim());
      const bytes = fs.readFileSync(meta.asset_path);

      return {
        bytes,
        mime: 'image/png' as const,
        width: meta.width,
        height: meta.height,
        seed: meta.seed,
        model: meta.model,
        gpuSeconds: meta.gpuSeconds ?? 0,
        asset_path: meta.asset_path,
        sha256: sha256(bytes),
      };
    } catch (e: any) {
      throw new Error(`[LOCAL_MPS_PARSE_FAILED] ${e.message}. Output: ${py.stdout}`);
    }
  },
};
