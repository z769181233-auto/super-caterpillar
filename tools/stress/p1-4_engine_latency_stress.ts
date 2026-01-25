import { performance } from 'perf_hooks';
import * as crypto from 'crypto';

/**
 * P24-0: Performance SLA Stress Test
 * 规则：
 * 1. 使用 HMAC 签名（对齐 APISpec V1.1）
 * 2. 支持核心引擎 SLA 验证：ce03 (2s), ce04 (3s), ce06 (1.5s)
 * 3. 并发从小到大演进：1 -> 5 -> 10 -> 20
 */

// Configuration
const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';
const API_KEY = process.env.API_KEY || 'dev-worker-key';
const API_SECRET = process.env.API_SECRET;

if (!API_SECRET) {
  console.error('[ERROR] API_SECRET is required for HMAC signing');
  process.exit(1);
}

// HMAC Helper
function getAuthHeaders(body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = "nonce_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  const contentSha256 = body ? crypto.createHash("sha256").update(body, "utf8").digest("hex") : "UNSIGNED";

  // Signature: apiKey + nonce + timestamp + body
  const payload = API_KEY + nonce + timestamp + body;
  const signature = crypto.createHmac("sha256", API_SECRET!).update(payload).digest("hex");

  return {
    'X-Api-Key': API_KEY,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Content-SHA256': contentSha256,
    'X-Signature': signature,
    'X-Hmac-Version': '1.1',
    'Content-Type': 'application/json'
  };
}

async function createJob(engine: string) {
  let jobType = '';
  let payload = {};
  const projectId = process.env.PROJ_ID || 'stress-test';

  if (engine === 'ce03') {
    jobType = 'CE03_VISUAL_DENSITY';
    payload = { projectId, engineKey: 'ce03_visual_density', text: 'Sample text for CE03' };
  } else if (engine === 'ce04') {
    jobType = 'CE04_VISUAL_ENRICHMENT';
    payload = { projectId, engineKey: 'ce04_visual_enrichment', text: 'Sample text for CE04' };
  } else if (engine === 'ce06') {
    jobType = 'CE06_NOVEL_PARSING';
    payload = { projectId, engineKey: 'ce06_novel_parsing', sourceText: 'Sample text for CE06' };
  }

  const body = JSON.stringify({ type: jobType, payload });
  const headers = getAuthHeaders(body);

  const res = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[STRESS] Create JOB FAILED: ${res.status} ${errText} (Key: ${API_KEY.substring(0, 5)}...)`);
    throw new Error(`Failed to create job: ${res.status} ${errText}`);
  }
  const data: any = await res.json();
  const jobId = data.data?.id || data.id;
  console.log(`[STRESS] Created Job: ${jobId} (Type: ${jobType})`);
  return jobId;
}

async function waitForJob(jobId: string, timeoutMs: number = 90000): Promise<number> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        headers: getAuthHeaders(''),
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      const data: any = await res.json();
      const job = data.data || data;
      if (job.status === 'SUCCEEDED') {
        return performance.now() - start;
      }
      if (job.status === 'FAILED') {
        throw new Error(`Job FAILED: ${job.lastError || 'Unknown error'}`);
      }
    } catch (e) {
      // Ignore network blips during stress
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Job TIMEOUT');
}

async function runPhase(concurrency: number, durationSeconds: number) {
  console.log(`\n=== Running Phase: Concurrency ${concurrency} for ${durationSeconds}s ===`);
  const endAt = Date.now() + durationSeconds * 1000;
  const latencies: Record<string, number[]> = { ce03: [], ce04: [], ce06: [] };
  const errors: Record<string, number> = { ce03: 0, ce04: 0, ce06: 0 };
  const timeouts: Record<string, number> = { ce03: 0, ce04: 0, ce06: 0 };

  const engineList = ['ce03', 'ce04', 'ce06'];

  const runWorker = async (index: number) => {
    while (Date.now() < endAt) {
      const engine = engineList[index % engineList.length];
      try {
        const jobId = await createJob(engine);
        const latency = await waitForJob(jobId);
        latencies[engine].push(latency);
      } catch (err: any) {
        console.error(`[Worker ${index}] Error: ${err.message}`);
        if (err.message.includes('TIMEOUT')) timeouts[engine]++;
        else errors[engine]++;
        // Wait a bit on error to avoid tight error loops
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(runWorker(i));
  }

  await Promise.all(workers);

  // Stats
  for (const engine of engineList) {
    const lats = latencies[engine].sort((a, b) => a - b);
    const count = lats.length;
    if (count === 0) {
      console.log(`[${engine}] No requests completed.`);
      continue;
    }
    const avg = lats.reduce((a, b) => a + b, 0) / count;
    const p50 = lats[Math.floor(count * 0.5)];
    const p95 = lats[Math.floor(count * 0.95)];
    const p99 = lats[Math.floor(count * 0.99)];

    console.log(
      `[${engine}] Count: ${count}, Avg: ${avg.toFixed(2)}ms, P50: ${p50.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
    );
    if (errors[engine] > 0 || timeouts[engine] > 0) {
      console.log(`[${engine}] ⚠️ Errors: ${errors[engine]}, Timeouts: ${timeouts[engine]}`);
    }
  }
}

async function main() {
  console.log(`[STRESS] Warmup phase (N=1)...`);
  await runPhase(1, 10);

  console.log(`[STRESS] Starting main stress test...`);
  await runPhase(1, 30);
  await runPhase(5, 30);
  await runPhase(10, 30);
  await runPhase(20, 60); // Final push
}

main().catch(console.error);
