import * as crypto from 'crypto';
import * as fs from 'fs';

export type Ppv64Result = {
  vec: Float32Array; // length 64, L2-normalized
  embeddingHash: string; // sha256 of float32 bytes
  fileSha256: string; // sha256 of original file bytes
};

function sha256File(path: string): string {
  const buf = fs.readFileSync(path);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256Float32(vec: Float32Array): string {
  const buf = Buffer.from(vec.buffer);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// NOTE: decodeRGBA must be wired to your existing image decode stack.
export type DecodeRGBA = (
  absPath: string
) => Promise<{ width: number; height: number; rgba: Uint8Array }>;

export async function ppv64FromImage(
  absPath: string,
  decodeRGBA: DecodeRGBA
): Promise<Ppv64Result> {
  const { width, height, rgba } = await decodeRGBA(absPath);

  // 8x8 cell average grayscale
  const gridW = 8,
    gridH = 8;
  const out = new Float32Array(64);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor((gx * width) / gridW);
      const x1 = Math.floor(((gx + 1) * width) / gridW);
      const y0 = Math.floor((gy * height) / gridH);
      const y1 = Math.floor(((gy + 1) * height) / gridH);

      let sum = 0;
      let cnt = 0;
      for (let y = y0; y < Math.max(y0 + 1, y1); y++) {
        for (let x = x0; x < Math.max(x0 + 1, x1); x++) {
          const idx = (y * width + x) * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          // fixed grayscale weights
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += gray;
          cnt++;
        }
      }
      out[gy * gridW + gx] = cnt > 0 ? sum / cnt : 0;
    }
  }

  // standardize then L2 normalize for cosine stability
  let mean = 0;
  for (let i = 0; i < 64; i++) mean += out[i];
  mean /= 64;

  let varSum = 0;
  for (let i = 0; i < 64; i++) {
    const d = out[i] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / 64) + 1e-6;

  let norm = 0;
  for (let i = 0; i < 64; i++) {
    out[i] = (out[i] - mean) / std;
    norm += out[i] * out[i];
  }
  norm = Math.sqrt(norm) + 1e-6;
  for (let i = 0; i < 64; i++) out[i] /= norm;

  return {
    vec: out,
    embeddingHash: sha256Float32(out),
    fileSha256: sha256File(absPath),
  };
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 64; i++) dot += a[i] * b[i];
  // map [-1,1] -> [0,1] for stable thresholding
  const v = Math.max(-1, Math.min(1, dot));
  return (v + 1) / 2;
}
