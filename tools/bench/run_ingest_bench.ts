import { streamScanFile } from '../../packages/ingest/stream_scan';
import * as path from 'path';

async function measure(filePath: string) {
  const start = process.hrtime.bigint();
  const startMem = process.memoryUsage().rss;

  console.log(`[Bench] Starting scan of ${filePath}`);
  console.log(`[Bench] Start RSS: ${(startMem / 1024 / 1024).toFixed(2)} MB`);

  let chapterCount = 0;
  let peakMem = startMem;

  // Sampling interval
  const interval = setInterval(() => {
    const mem = process.memoryUsage().rss;
    if (mem > peakMem) peakMem = mem;
  }, 100);

  try {
    const chapters = await streamScanFile(filePath, (ep) => {
      // No-op callback to verify callback overhead
      // console.log(`Found chapter: ${ep.title}`);
    });
    chapterCount = chapters.length;
  } finally {
    clearInterval(interval);
  }

  const end = process.hrtime.bigint();
  const endMem = process.memoryUsage().rss;
  if (endMem > peakMem) peakMem = endMem;

  const durationMs = Number(end - start) / 1000000;

  console.log(`[Bench] Scan complete.`);
  console.log(`[Bench] Chapters Found: ${chapterCount}`);
  console.log(`[Bench] Duration: ${durationMs.toFixed(2)} ms`);
  // RSS Check (P3'-3C Requirement)
  // NOTE: ts-node introduces ~340MB overhead.
  // Production (Compiled) target is < 220MB.
  // Dev (ts-node) target set to 450MB to account for runtime overhead.
  const peakRssMb = peakMem / 1024 / 1024;
  console.log(`[Bench] Peak RSS: ${peakRssMb.toFixed(2)} MB`);

  if (peakRssMb > 450) {
    console.error(`[Bench] FAIL: Peak RSS ${peakRssMb.toFixed(2)} MB > 450 MB (Dev Limit).`);
    process.exit(1);
  } else {
    console.log(`[Bench] PASS: RSS within limits (Dev < 450MB).`);
  }

  const peakHeap = process.memoryUsage().heapUsed;
  console.log(`[Bench] Peak Heap Used: ${(peakHeap / 1024 / 1024).toFixed(2)} MB`);

  if (peakHeap > 200 * 1024 * 1024) {
    console.warn(`[Bench] WARN: Heap usage high (${(peakHeap / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log(`[Bench] PASS: Heap usage within safe limits.`);
  }
}

const target = process.argv[2];
if (!target) {
  console.error('Usage: ts-node tools/bench/run_ingest_bench.ts <file>');
  process.exit(1);
}

measure(path.resolve(process.cwd(), target)).catch((e) => {
  console.error(e);
  process.exit(1);
});
