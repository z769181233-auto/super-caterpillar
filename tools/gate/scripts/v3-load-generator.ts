import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

// =============================================================================
// Configuration
// =============================================================================
const API_URL = process.env.API_URL || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
const TARGET_JOBS = parseInt(process.env.TARGET_JOBS || '10', 10);
const BASE_PROJECT_ID = process.env.PROJECT_ID; // Used for Org ID lookup
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || process.cwd();
const DATABASE_URL = process.env.DATABASE_URL;

if (!BASE_PROJECT_ID) {
  console.error('❌ PROJECT_ID (Base) env var required');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL env var required');
  process.exit(1);
}

// =============================================================================
// Metric Structures
// =============================================================================
interface JobMetric {
  traceId: string;
  storyJobId: string;
  shotJobId?: string;
  startTime: number;
  parseEndTime: number;
  shotGenEndTime: number;
  totalDuration: number;
  status: 'SUCCEEDED' | 'FAILED';
  error?: string;
  assetId?: string;
}

const metrics: JobMetric[] = [];

// =============================================================================
// Utils
// =============================================================================
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple Semaphore
class Semaphore {
  private tasks: (() => void)[] = [];
  private count: number;

  constructor(count: number) {
    this.count = count;
  }

  async acquire() {
    if (this.count > 0) {
      this.count--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.tasks.push(resolve);
    });
  }

  release() {
    this.count++;
    if (this.tasks.length > 0) {
      this.count--;
      const resolve = this.tasks.shift();
      if (resolve) resolve();
    }
  }
}

// =============================================================================
// Logic
// =============================================================================

async function pollJob(
  jobId: string,
  endpointType: 'story' | 'shot',
  timeoutMs: number = 180000
): Promise<any> {
  const start = Date.now();
  const endpoint = `${API_URL}/v3/${endpointType}/job/${jobId}`;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(endpoint);
      const status = res.data.status;
      if (status === 'SUCCEEDED' || status === 'FAILED') {
        return res.data;
      }
    } catch (e: any) {
      // console.warn(`[Warn] Polling ${jobId} failed: ${e.message}`);
    }
    await sleep(2000);
  }
  throw new Error(`Job ${jobId} timed out`);
}

/**
 * FIX-C: Helper to extract DATABASE_URL into standard PG env vars.
 * Ensures psql connects correctly without hardcoding URL in command.
 */
function getDbEnv() {
  try {
    const url = new URL(DATABASE_URL as string);
    return {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: url.pathname.slice(1),
      PGUSER: url.username,
      PGPASSWORD: url.password,
    };
  } catch (e) {
    return { ...process.env, DATABASE_URL };
  }
}

async function fetchSceneId(projectId: string, traceId: string): Promise<string> {
  const safeTrace = traceId.replace(/'/g, "''");
  let lastError = '';

  // FIX-B: 20 attempts * 5s = 100s window to handle async fan-out
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      // FIX-B: Deterministic match using traceId in title
      const sql = `SELECT id FROM scenes WHERE project_id = '${projectId}' AND title ILIKE '%' || '${safeTrace}' || '%' ORDER BY created_at DESC;`;

      // FIX-C: Hardened psql via standard PG env vars
      const output = execSync(`psql -X -At -c "${sql}"`, {
        shell: '/bin/bash',
        env: getDbEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .toString()
        .trim();

      if (output) {
        const ids = output.split('\n').filter((id) => id.length > 20);
        if (ids.length > 1) {
          console.log(
            `[Metric] MULTI_SCENE_MATCH for Trace=${traceId}, Proj=${projectId}. Using latest.`
          );
        }
        if (ids.length > 0) return ids[0];
      }
      lastError = `Attempt ${attempt}: No scene found with traceId in title. Proj='${projectId}', Trace='${traceId}'`;
    } catch (e: any) {
      lastError = `Attempt ${attempt} psql error: ${e.message}. Stderr: ${e.stderr?.toString()}`;
    }
    if (attempt < 20) await sleep(5000);
  }

  throw new Error(
    `fetchSceneId FAILED after 100s. Trace=${traceId}, Proj=${projectId}\nDetails: ${lastError}`
  );
}

function createUniqueProject(baseProjectId: string, index: number): string {
  try {
    // FIX-C: Hardened psql via standard PG env vars
    const queryCmd = `psql -X -At -c "SELECT \\"organizationId\\", \\"ownerId\\" FROM projects WHERE id = '${baseProjectId}' LIMIT 1;"`;
    const output = execSync(queryCmd, {
      shell: '/bin/bash',
      env: getDbEnv(),
    })
      .toString()
      .trim();
    if (!output) throw new Error('Could not find Base Project');

    const [orgId, ownerId] = output.split('|').map((s) => s.trim());
    if (!orgId || !ownerId) throw new Error('Invalid Base Project Data');

    // 2. Insert New Project
    const newProjectId = randomUUID();
    const insertCmd = `psql -X -c "INSERT INTO projects (id, \\"organizationId\\", name, \\"ownerId\\", \\"createdAt\\", \\"updatedAt\\") VALUES ('${newProjectId}', '${orgId}', 'Load Test Project ${index} ${Date.now()}', '${ownerId}', NOW(), NOW());"`;
    execSync(insertCmd, {
      stdio: 'ignore',
      shell: '/bin/bash',
      env: getDbEnv(),
    });

    return newProjectId;
  } catch (e: any) {
    throw new Error(`Create Unique Project Failed: ${e.message}`);
  }
}

async function runScenario(index: number, semaphore: Semaphore) {
  await semaphore.acquire();

  // Create Unique Project for Isolation
  let projectId = BASE_PROJECT_ID;
  try {
    projectId = createUniqueProject(BASE_PROJECT_ID, index);
  } catch (e) {
    console.error(`[${index}] FAILED to create project:`, e);
    // fallback to base? No, fail.
    metrics.push({
      traceId: 'init_fail',
      storyJobId: '',
      startTime: Date.now(),
      parseEndTime: 0,
      shotGenEndTime: 0,
      totalDuration: 0,
      status: 'FAILED',
      error: 'Project Init Failed',
    });
    semaphore.release();
    return;
  }

  const traceId = `load_test_${Date.now()}_${index}`;
  const start = Date.now();
  const metric: JobMetric = {
    traceId,
    storyJobId: '',
    startTime: start,
    parseEndTime: 0,
    shotGenEndTime: 0,
    totalDuration: 0,
    status: 'FAILED',
  };

  try {
    console.log(`[${index}] Starting (Trace=${traceId}, Proj=${projectId})...`);

    // 1. Story Parse
    // FIX-A: Inject traceId into title for deterministic scene lookup
    const parseRes = await axios.post(`${API_URL}/v3/story/parse`, {
      project_id: projectId,
      raw_text: `Load Test Story ${index} (Trace ${traceId})`,
      title: `Load Test ${index} [trace=${traceId}]`,
      trace_id: traceId, // FIX-D: Propagate traceId through entire system
    });
    metric.storyJobId = parseRes.data.job_id;
    // Use generator's traceId for scene lookup to ensure 100% precision
    const lookupTraceId = traceId;

    const parseJob = await pollJob(metric.storyJobId, 'story');
    if (parseJob.status !== 'SUCCEEDED')
      throw new Error(`Parse failed: ${parseJob.error?.message}`);
    metric.parseEndTime = Date.now();

    // 2. Fetch Scene (Deterministic Match)
    const sceneId = await fetchSceneId(projectId, lookupTraceId);

    // 3. Shot Gen
    const shotRes = await axios.post(`${API_URL}/v3/shot/batch-generate`, { scene_id: sceneId });
    metric.shotJobId = shotRes.data.job_id;

    const shotJob = await pollJob(metric.shotJobId!, 'shot');
    if (shotJob.status !== 'SUCCEEDED')
      throw new Error(`ShotGen failed: ${shotJob.error?.message}`);

    metric.shotGenEndTime = Date.now();

    // V3 Logic: Use result_preview explicitly returned by V3 API
    const preview = shotJob.result_preview || {};
    metric.assetId =
      preview.asset_id || (preview.shots_count > 0 ? `shots_v3_${preview.shots_count}` : null);

    if (!metric.assetId) {
      console.warn(`[${index}] Full Job Response:`, JSON.stringify(shotJob));
      throw new Error('Asset ID missing in receipt (V3)');
    }

    metric.status = 'SUCCEEDED';
    console.log(`[${index}] SUCCEEDED (Evidence=${metric.assetId}).`);
  } catch (e: any) {
    metric.error = e.message;
    console.error(`[${index}] FAILED: ${e.message}`);
  } finally {
    metric.totalDuration = Date.now() - start;
    metrics.push(metric);
    semaphore.release();
  }
}

async function main() {
  // 0. Ensure System User Exists (Unblocks Billing/CostLedger)
  try {
    const checkSystemUser = `psql -X -At -c "SELECT id FROM users WHERE id = 'system' LIMIT 1;"`;
    const systemUserExists = execSync(checkSystemUser, {
      shell: '/bin/bash',
      env: getDbEnv(),
    })
      .toString()
      .trim();
    if (!systemUserExists) {
      console.log("[Setup] Creating 'system' user for Billing...");
      const createSystemUser = `psql -X -c "INSERT INTO users (id, email, \\"passwordHash\\", \\"createdAt\\", \\"updatedAt\\") VALUES ('system', 'system@internal.io', 'hash', NOW(), NOW());"`;
      execSync(createSystemUser, {
        stdio: 'ignore',
        shell: '/bin/bash',
        env: getDbEnv(),
      });
    }
  } catch (e) {
    console.warn('[Setup] Failed to check/create system user:', e);
  }

  console.log(
    `Starting Load Generator: Concurrency=${CONCURRENCY}, Targets=${TARGET_JOBS}, Output=${EVIDENCE_DIR}`
  );
  const semaphore = new Semaphore(CONCURRENCY);

  const promises = [];
  for (let i = 0; i < TARGET_JOBS; i++) {
    promises.push(runScenario(i, semaphore));
  }

  await Promise.all(promises);

  // Calculate Stats
  const passed = metrics.filter((m) => m.status === 'SUCCEEDED');
  const durations = passed.map((m) => m.totalDuration).sort((a, b) => a - b);

  let p95 = 0;
  if (durations.length > 0) {
    const idx = Math.ceil(0.95 * durations.length) - 1;
    p95 = durations[idx];
  }

  const summary = {
    total: metrics.length,
    passed: passed.length,
    failed: metrics.length - passed.length,
    p95_latency_ms: p95,
    success_rate: metrics.length > 0 ? (passed.length / metrics.length) * 100 : 0,
  };

  console.log('Summary:', JSON.stringify(summary, null, 2));

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2));
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  const storyJobs = metrics.map((m) => m.storyJobId).filter(Boolean);
  const shotJobs = metrics.map((m) => m.shotJobId).filter(Boolean);

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'story_jobs.json'), JSON.stringify(storyJobs, null, 2));
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'shot_jobs.json'), JSON.stringify(shotJobs, null, 2));
}

main().catch((e) => {
  console.error('Generator Fatal:', e);
  process.exit(1);
});
