import * as fs from 'fs';
import * as path from 'path';

function findLatestJson(evidenceDir: string): string {
  console.log(`[FILL-CAPACITY] Searching in: ${evidenceDir}`);
  if (!fs.existsSync(evidenceDir)) {
    console.error(`[FILL-CAPACITY] ❌ Directory not found: ${evidenceDir}`);
    return '';
  }

  const files = fs.readdirSync(evidenceDir);
  console.log(`[FILL-CAPACITY] Total files in dir: ${files.length}`);

  const capacityFiles = files
    .filter((f) => f.startsWith('capacity_api_') && f.endsWith('.json'))
    .map((f) => ({
      name: f,
      fullPath: path.join(evidenceDir, f),
      mtime: fs.statSync(path.join(evidenceDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (!capacityFiles.length) {
    console.error(`[FILL-CAPACITY] ❌ No capacity_api_*.json found in ${evidenceDir}`);
    console.log('[FILL-CAPACITY] Directory listing (first 10):');
    files.slice(0, 10).forEach((f) => console.log(`  - ${f}`));
    throw new Error('No capacity_api_*.json found');
  }
  
  console.log(`[FILL-CAPACITY] Found ${capacityFiles.length} candidate(s). Using latest: ${capacityFiles[0].name}`);
  return capacityFiles[0].fullPath;
}

function replaceBlock(md: string, replacements: Record<string, string>): string {
  let out = md;
  for (const [k, v] of Object.entries(replacements)) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), v);
  }
  return out;
}

const repoRoot = path.resolve(__dirname, '../..');
const reportPath = path.join(repoRoot, 'docs/LAUNCH_CAPACITY_REPORT.md');
const evidenceDir = process.env.EVI_DIR || path.join(repoRoot, 'docs/_evidence');

console.log(`[FILL-CAPACITY] Start: report=${reportPath}, evidenceDir=${evidenceDir}`);

const latest = findLatestJson(evidenceDir);
const j = JSON.parse(fs.readFileSync(latest, 'utf8'));

const md = fs.readFileSync(reportPath, 'utf8');

// 精确替换“压测结果”区块中的占位符
const filledOnce = replaceBlock(md, {
  '- 总请求数: <待填充>': `- 总请求数: ${j.total}`,
  '- 成功数: <待填充> (<待填充>%)': `- 成功数: ${j.success} (${(j.successRate * 100).toFixed(2)}%)`,
  '- 失败数: <待填充> (<待填充>%)': `- 失败数: ${j.failed} (${((j.failed / j.total) * 100).toFixed(2)}%)`,
  '- 容量超限: <待填充> (<待填充>%)': `- 容量超限: ${j.capacityExceeded} (${(j.capacityExceededRate * 100).toFixed(2)}%)`,
  '- 持续时间: <待填充>s': `- 持续时间: ${j.durationSec.toFixed(2)}s`,
  '- 请求速率: <待填充> req/s': `- 请求速率: ${j.rps.toFixed(2)} req/s`,
  '  - Min: <待填充>ms': `  - Min: ${j.latencyMs.min}ms`,
  '  - Max: <待填充>ms': `  - Max: ${j.latencyMs.max}ms`,
  '  - Average: <待填充>ms': `  - Average: ${j.latencyMs.avg.toFixed(2)}ms`,
  '  - P50: <待填充>ms': `  - P50: ${j.latencyMs.p50}ms`,
  '  - P95: <待填充>ms': `  - P95: ${j.latencyMs.p95}ms`,
  '  - P99: <待填充>ms': `  - P99: ${j.latencyMs.p99}ms`,
});

// 兜底：清理残留的 "<待填充> req/s" 之类
const finalMd = replaceBlock(filledOnce, {
  '<待填充> req/s': `${j.rps.toFixed(2)} req/s`,
});

fs.writeFileSync(reportPath, finalMd, 'utf8');

console.log(
  JSON.stringify(
    {
      filled: true,
      reportPath,
      evidence: latest,
      pass: !!j.pass,
      successRate: j.successRate,
      p95: j.latencyMs?.p95,
    },
    null,
    2
  )
);
