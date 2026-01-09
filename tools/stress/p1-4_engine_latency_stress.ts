import { ApiClient } from '../../apps/workers/src/api-client';
import { performance } from 'perf_hooks';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'dev-worker-key';
const API_SECRET = process.env.API_SECRET; // Not needed for internal job creation if using direct API Client?
// Actually we need to act as a CLIENT creating jobs, or a Worker?
// The user says "Worker 实际执行链路".
// The stress test should CREATE jobs via API, and wait for them to finish?
// Or just creating jobs is enough if we monitor metrics?
// "采集 latency... p50 / p95 / p99" -> We need to know when job finishes.
// We can poll job status.

if (!API_KEY) {
  console.error('API_KEY is required');
  process.exit(1);
}

// We can use a simple fetch to create jobs and poll.
const ENGINES = ['ce03', 'ce04', 'ce06'];
const SLA = {
  ce03: { p95: 2000, p99: 3000 },
  ce04: { p95: 3000, p99: 5000 },
  ce06: { p95: 1500, p99: 2500 },
};

async function createJob(engine: string) {
  // Map engine to JobType
  let jobType = '';
  let payload = {};
  if (engine === 'ce03') {
    jobType = 'CE03_VISUAL_DENSITY';
    payload = { projectId: 'stress-test', engineKey: 'ce03_visual_density' };
  } else if (engine === 'ce04') {
    jobType = 'CE04_VISUAL_ENRICHMENT';
    payload = { projectId: 'stress-test', engineKey: 'ce04_visual_enrichment' };
  } else if (engine === 'ce06') {
    jobType = 'CE06_NOVEL_PARSING';
    payload = {
      projectId: 'stress-test',
      engineKey: 'ce06_novel_parsing',
      novelSourceId: 'test-source',
    };
  }

  const res = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY, // Assume dev key allows creation or use internal endpoint
    },
    body: JSON.stringify({
      type: jobType,
      payload,
    }),
  });

  // Note: /api/jobs usually requires auth.
  // If we run `gate-p1-3` logic, it uses valid keys or GATE_MODE bypass.
  // For stress test, we should assume valid environment.

  if (!res.ok) {
    throw new Error(`Failed to create job: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.id; // Assume { id: '...' }
}

async function waitForJob(jobId: string, timeoutMs: number = 10000): Promise<number> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      headers: { 'X-Api-Key': API_KEY },
    });
    if (!res.ok) continue;
    const job = await res.json();
    if (job.status === 'SUCCEEDED') {
      return performance.now() - start;
    }
    if (job.status === 'FAILED') {
      throw new Error('Job FAILED');
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Job TIMEOUT');
}

async function runPhase(concurrency: number, durationSeconds: number) {
  console.log(`\n=== Running Phase: Concurrency ${concurrency} for ${durationSeconds}s ===`);
  const endAt = Date.now() + durationSeconds * 1000;
  const latencies: Record<string, number[]> = { ce03: [], ce04: [], ce06: [] };
  const errors: Record<string, number> = { ce03: 0, ce04: 0, ce06: 0 };
  const timeouts: Record<string, number> = { ce03: 0, ce04: 0, ce06: 0 };

  const activePromises: Promise<void>[] = [];

  async function worker(engine: string) {
    while (Date.now() < endAt) {
      try {
        const jobId = await createJob(engine);
        // Wait for completion (simulating end-to-end latency seen by user)
        const latency = await waitForJob(jobId);
        latencies[engine].push(latency);
      } catch (err: any) {
        if (err.message === 'Job TIMEOUT') timeouts[engine]++;
        else errors[engine]++;
      }
    }
  }

  // Start workers
  // We split concurrency among engines.
  // If concurrency=1, we verify one by one?
  // Or we run N workers per engine?
  // User said "Concurrency: N = 1 -> 5 -> 10 -> 20".
  // I will distribute N across 3 engines or run N per engine?
  // "Total N workers". Let's say N workers picking random engine or round robin.

  const engines = ['ce03', 'ce04', 'ce06'];
  for (let i = 0; i < concurrency; i++) {
    activePromises.push(worker(engines[i % engines.length]));
  }

  await Promise.all(activePromises);

  // Calculate stats
  for (const engine of engines) {
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
    console.log(`[${engine}] Errors: ${errors[engine]}, Timeouts: ${timeouts[engine]}`);
  }
}

async function main() {
  // Warmup?

  // Concurrency 1
  await runPhase(1, 60);

  // Concurrency 5
  await runPhase(5, 60);

  // Concurrency 10
  await runPhase(10, 60);

  // Concurrency 20
  await runPhase(20, 60);
}

main().catch(console.error);
