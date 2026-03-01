import fs from 'fs';
import crypto from 'crypto';

// Helper: Calculate SHA256 of a file using streams
function sha256File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(p)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

// Helper: Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k, def) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : def;
  };
  return {
    seed: get('--seed', 'docs/_bench/bench_seed.json'),
    out: get('--out', 'docs/_bench/bench_novel_large.txt'),
    targetBytes: Number(get('--target-bytes', '65000000')), // Default 65MB
  };
}

async function main() {
  const { seed, out, targetBytes } = parseArgs();

  if (!fs.existsSync(seed)) {
    throw new Error(`Seed file not found: ${seed}`);
  }

  const seedObj = JSON.parse(fs.readFileSync(seed, 'utf8'));
  const quotes = seedObj.quotes?.map((q) => String(q).trim()).filter(Boolean);

  if (!quotes?.length) throw new Error('bench_seed.json missing quotes[]');

  // Ensure output dir exists
  const path = await import('path');
  await fs.promises.mkdir(path.dirname(out), { recursive: true });

  const ws = fs.createWriteStream(out, { encoding: 'utf8' });
  let written = 0;
  let idx = 0;

  const newline = '\n';
  const nlBytes = Buffer.byteLength(newline);

  console.log(`[BenchGen] Generating ${targetBytes} bytes to ${out} using seed ${seed}...`);

  // Stream Write Loop
  while (written < targetBytes) {
    const s = quotes[idx % quotes.length] + newline;
    const canWrite = ws.write(s); // Returns false if buffer is full
    written += Buffer.byteLength(s) + nlBytes;
    idx++;

    // Backpressure handling: if buffer full, wait for drain
    if (!canWrite) {
      await new Promise((resolve) => ws.once('drain', resolve));
    }

    // Yield every 2000 lines to verify event loop non-blocking (optional but good per spec)
    if (idx % 2000 === 0) {
      await new Promise((r) => setImmediate(r));
    }
  }

  // Close stream
  await new Promise((resolve, reject) => ws.end(resolve));

  // Verify
  const st = fs.statSync(out);
  const hash = await sha256File(out);

  const meta = {
    seed,
    out,
    targetBytes,
    actualBytes: st.size,
    sha256: hash,
    generatedAt: new Date().toISOString(),
    loops: idx,
  };

  const metaPath = out.replace(/\.txt$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  console.log(`[BenchGen] Success. Meta: ${metaPath}`);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
