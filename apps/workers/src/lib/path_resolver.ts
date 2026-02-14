import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export async function sha256File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('data', (d) => h.update(d));
    s.on('error', reject);
    s.on('end', () => resolve(h.digest('hex')));
  });
}

function existsNonEmpty(p: string) {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

/**
 * Resolve a storageKey (or localPath) to a real local mp4 path.
 * MUST be deterministic + debuggable.
 */
export function resolveLocalMp4Path(storageKeyOrPath: string): { path: string; tried: string[] } {
  const tried: string[] = [];

  // 0) if engine returned absolute local path
  if (path.isAbsolute(storageKeyOrPath)) {
    tried.push(storageKeyOrPath);
    if (existsNonEmpty(storageKeyOrPath)) return { path: storageKeyOrPath, tried };
  }

  // 1) treat as relative path
  const relCandidate = path.resolve(process.cwd(), storageKeyOrPath);
  tried.push(relCandidate);
  if (existsNonEmpty(relCandidate)) return { path: relCandidate, tried };

  // 2) known storage roots (keep minimal but practical)
  const roots = [
    process.env.SCU_STORAGE_DIR,
    process.env.STORAGE_DIR,
    path.resolve(process.cwd(), '.data', 'storage'),
    path.resolve(process.cwd(), 'data', 'storage'),
  ].filter(Boolean) as string[];

  for (const r of roots) {
    const p = path.resolve(r, storageKeyOrPath);
    tried.push(p);
    if (existsNonEmpty(p)) return { path: p, tried };
  }

  // 3) if storageKey has leading "storage/" etc
  const normalized = storageKeyOrPath.replace(/^\/+/, '').replace(/^storage\//, '');
  if (normalized !== storageKeyOrPath) {
    for (const r of roots) {
      const p = path.resolve(r, normalized);
      tried.push(p);
      if (existsNonEmpty(p)) return { path: p, tried };
    }
  }

  throw new Error(
    `W3-1: cannot resolve local mp4 from key=${storageKeyOrPath}. tried=\n- ${tried.join('\n- ')}`
  );
}
