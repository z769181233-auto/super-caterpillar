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
    options: {
      width?: number;
      height?: number;
      seed: number;
      // P2-FIX-2: 必填追溯字段
      shotId: string;
      traceId: string;
    }
  ): Promise<RenderResult> {
    // P2-FIX-2: 强制校验必填字段
    if (!options.shotId || !options.traceId) {
      throw new Error(
        `[LOCAL_MPS_PROVIDER_INVALID] Missing required fields: shotId=${options.shotId}, traceId=${options.traceId}`
      );
    }

    const width = options.width ?? 768;
    const height = options.height ?? 768;
    const seed = options.seed;
    const { shotId, traceId } = options;

    // P2-FIX-2: 统一命名规范（inline 实现避免跨 package 导入）
    const safeShot = shotId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeTrace = traceId.slice(-8).replace(/[^a-zA-Z0-9_-]/g, '_');
    const artifactName = `shot_${safeShot}_trace_${safeTrace}_${seed}.png`;

    // P2-FIX-2 DEBUG: 打印命名参数（仅 Gate/Dev）
    if (process.env.GATE_MODE === '1' || process.env.NODE_ENV !== 'production') {
      console.log(
        `[LocalMpsProvider] Artifact name: ${artifactName} (shotId=${shotId}, traceId=${traceId}, seed=${seed})`
      );
    }

    const outDir =
      process.env.ASSET_STORAGE_DIR ||
      (process.env.STORAGE_ROOT
        ? path.join(process.env.STORAGE_ROOT, 'assets')
        : path.join(process.cwd(), 'apps/workers/.runtime/assets'));
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, artifactName);
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

      // P1: Normalize asset_path to be relative for audit trail
      let relativePath = meta.asset_path;
      try {
        // packages/engines/shot_render/providers/ -> ../../../..
        const root = path.resolve(__dirname, '../../../../..');
        relativePath = path.relative(root, meta.asset_path);
        // Convert to POSIX
        relativePath = relativePath.split(path.sep).join('/');
      } catch (e) {}

      return {
        bytes,
        mime: 'image/png' as const,
        width: meta.width,
        height: meta.height,
        seed: meta.seed,
        model: meta.model,
        gpuSeconds: meta.gpuSeconds ?? 0,
        asset_path: relativePath,
        sha256: sha256(bytes),
      };
    } catch (e: any) {
      throw new Error(`[LOCAL_MPS_PARSE_FAILED] ${e.message}. Output: ${py.stdout}`);
    }
  },
};
