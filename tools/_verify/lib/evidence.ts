import fs from 'node:fs';
import path from 'node:path';

export type EvidenceDir = {
  dir: string;
  jsonlPath: (name: string) => string;
  jsonPath: (name: string) => string;
  textPath: (name: string) => string;
};

export function ensureEvidenceDir(baseDir: string): EvidenceDir {
  fs.mkdirSync(baseDir, { recursive: true });
  return {
    dir: baseDir,
    jsonlPath: (name) => path.join(baseDir, name.endsWith('.jsonl') ? name : `${name}.jsonl`),
    jsonPath: (name) => path.join(baseDir, name.endsWith('.json') ? name : `${name}.json`),
    textPath: (name) => path.join(baseDir, name),
  };
}

export function appendEvidenceJSONL(filePath: string, data: unknown) {
  const line = JSON.stringify(data);
  fs.appendFileSync(filePath, line + '\n', 'utf8');
}

export function writeEvidenceJSON(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** 防止误把巨大对象打印/写爆：截断字符串字段、限制数组长度、深度限制 */
export function safeSummary(
  input: any,
  opts?: { maxDepth?: number; maxArray?: number; maxString?: number }
) {
  const maxDepth = opts?.maxDepth ?? 3;
  const maxArray = opts?.maxArray ?? 20;
  const maxString = opts?.maxString ?? 800;

  const seen = new WeakSet();

  function walk(v: any, depth: number): any {
    if (v == null) return v;
    if (typeof v === 'string')
      return v.length > maxString ? v.slice(0, maxString) + `…(truncated:${v.length})` : v;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v !== 'object') return String(v);

    if (seen.has(v)) return '[Circular]';
    seen.add(v);

    if (depth <= 0) return '[MaxDepth]';

    if (Array.isArray(v)) {
      const arr = v.slice(0, maxArray).map((x) => walk(x, depth - 1));
      if (v.length > maxArray) arr.push(`[+${v.length - maxArray} more]`);
      return arr;
    }

    const out: Record<string, any> = {};
    const keys = Object.keys(v);
    for (const k of keys) out[k] = walk(v[k], depth - 1);
    return out;
  }

  return walk(input, maxDepth);
}
