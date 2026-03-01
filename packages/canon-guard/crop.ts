import sharp from 'sharp';
import path from 'path';
import { ensureDir } from '../shared/fs_async';

export type NormalizedRect = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
};

/**
 * Generates 200% zoomed crops for audit based on normalized rects.
 */
export async function genCrops200(
  imagePath: string,
  outDir: string,
  rects: NormalizedRect[]
): Promise<{ key: string; path: string; bytes: number }[]> {
  await ensureDir(outDir);

  const img = sharp(imagePath);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error('CROP_META_MISSING');

  const W = meta.width;
  const H = meta.height;

  const results: { key: string; path: string; bytes: number }[] = [];
  for (const r of rects) {
    const left = Math.max(0, Math.floor(r.x * W));
    const top = Math.max(0, Math.floor(r.y * H));
    const width = Math.max(1, Math.floor(r.w * W));
    const height = Math.max(1, Math.floor(r.h * H));
    const scale = r.scale ?? 2.0;

    const outPath = path.join(outDir, `${r.key}_200.png`);

    // Extract and resize
    const buf = await sharp(imagePath)
      .extract({ left, top, width, height })
      .resize(Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)))
      .png()
      .toBuffer();

    await sharp(buf).toFile(outPath);
    results.push({ key: r.key, path: outPath, bytes: buf.length });
  }
  return results;
}
