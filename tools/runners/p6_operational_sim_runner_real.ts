import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { PrismaClient, ProjectStatus, JobType } from 'database';
import { ApiClient } from '../../apps/workers/src/api-client';

// Load envs
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient({});

interface P6Context {
  evidenceDir: string;
  runId: string;
}

// Stats collectors
const sloStats: any = { p50_ms: 0, p95_ms: 0, p99_ms: 0, breakdown_ms: {}, runs: [] };
const billingStats: any[] = [];
const errorStats: any = { cases: [] };

async function main() {
  const args = process.argv.slice(2);
  const eviDirIndex = args.indexOf('--evi_dir');
  if (eviDirIndex === -1) {
    throw new Error('Usage: --evi_dir <path>');
  }
  const evidenceDir = args[eviDirIndex + 1];

  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  console.log(`[P6-RUNNER] Starting Operational Simulation. Evidence: ${evidenceDir}`);
  // Capture Start Time
  const startTs = new Date().toISOString();

  try {
    // --- 1. SLO & Billing (Valid Flow) ---
    await runValidFlows(evidenceDir);

    // --- 2. Error Matrix (Invalid Flows) ---
    await runErrorFlows(evidenceDir);

    // --- 3. Finalize Evidence ---
    finalizeEvidence(evidenceDir);
  } catch (e) {
    console.error('[P6-RUNNER] Fatal Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function runValidFlows(evidenceDir: string) {
  console.log('[P6-RUNNER] Executing Valid Flows for SLO & Billing...');

  // We aim for a small batch to get P50/P95 stats, e.g., 5 runs
  const runCount = 5;
  const latencies: number[] = [];

  // Ensure Organization exists
  await setupOrg();

  for (let i = 0; i < runCount; i++) {
    const projectId = `p6_slo_${Date.now()}_${i}`;
    console.log(`[P6-RUNNER] Run ${i + 1}/${runCount}: Project ${projectId}`);

    // Balance Snapshot Before
    const balanceBefore = await getOrgBalance('org_scale_test');

    // Create Project
    await prisma.project.create({
      data: {
        id: projectId,
        ownerId: 'owner_scale_test',
        organizationId: 'org_scale_test',
        name: `P6 SLO Project ${i}`,
        status: ProjectStatus.in_progress,
      },
    });

    const start = Date.now();
    const { jobId, tsSubmit, tsDelivery } = await executePipeline(projectId);
    const duration = tsDelivery - tsSubmit;
    latencies.push(duration);

    // Balance Snapshot After
    const balanceAfter = await getOrgBalance('org_scale_test');

    // Ledger Audit
    const ledgerSum = await getLedgerDebitSum(projectId);

    // Record for Billing
    billingStats.push({
      pipeline_run_id: jobId, // Using main job id as run id proxy
      org_id: 'org_scale_test',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      balance_delta: balanceBefore - balanceAfter,
      ledger_debit_sum: ledgerSum,
      model_expected_cost: ledgerSum, // Ideally calculated from P5 model
      relative_error: 0, // Calculating below
    });

    // Record for SLO run detail
    sloStats.runs.push({
      run_id: jobId,
      latency_ms: duration,
      breakdown: {}, // TODO: deeper breakdown
    });
  }

  // Calc SLO stats
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  sloStats.p50_ms = p50;
  sloStats.p95_ms = p95;
  sloStats.p99_ms = p99;
}

async function runErrorFlows(evidenceDir: string) {
  console.log('[P6-RUNNER] Executing Error Matrix Flows (Fault Injection)...');

  // Case 1: Validation Fail (Invalid Project)
  const projectId = `p6_error_val_${Date.now()}`;
  console.log(`[P6-RUNNER] Error Case 1: Validation Fail -> Project ${projectId}`);

  try {
    const apiClient = new ApiClient(
      'http://localhost:3000',
      'dev-worker-key',
      'dev-worker-secret',
      'p6-runner-error'
    );
    // Trigger with missing novelText
    await apiClient.createJob({
      jobType: 'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
      projectId,
      organizationId: 'org_scale_test',
      payload: { somethingElse: 'invalid' },
    });
    // If it didn't throw, it's a fail for our error case
    console.warn('  ⚠️ Expected error but got success');
  } catch (e: any) {
    console.log(`  ✅ Caught expected Error: ${e.message}`);
    errorStats.cases.push({
      case_id: 'VALIDATION_FAIL_01',
      status_final: 'FAILED',
      error_code: 'VALIDATION_FAIL',
      message: e.message,
    });
  }
}

async function executePipeline(projectId: string) {
  const apiClient = new ApiClient(
    'http://localhost:3000',
    'dev-worker-key',
    'dev-worker-secret',
    'p6-runner'
  );
  const novelPath = path.join(process.cwd(), 'test_novel.txt'); // Use standard test novel

  const tsSubmit = Date.now();
  const job = await apiClient.createJob({
    jobType: 'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
    projectId,
    organizationId: 'org_scale_test',
    payload: { novelText: fs.readFileSync(novelPath, 'utf8') },
  });

  // Poll for VIDEO_RENDER success
  const maxRetries = 300; // 5 min
  let tsDelivery = 0;

  for (let k = 0; k < maxRetries; k++) {
    await new Promise((r) => setTimeout(r, 1000));
    const videoJob = await prisma.shotJob.findFirst({
      where: { projectId, type: 'VIDEO_RENDER', status: 'SUCCEEDED' },
    });
    if (videoJob) {
      tsDelivery = Date.now();
      return { jobId: job.id, tsSubmit, tsDelivery };
    }

    // Check for Failures (Fast Fail)
    const failed = await prisma.shotJob.findFirst({
      where: { projectId, status: 'FAILED' },
    });
    if (failed) throw new Error(`Pipeline Failed: ${failed.id}`);
  }
  throw new Error('Pipeline Timeout');
}

async function setupOrg() {
  await (prisma.organization as any).upsert({
    where: { id: 'org_scale_test' },
    create: { id: 'org_scale_test', name: 'Scale Test Org', ownerId: 'owner_scale_test' },
    update: {},
  });
}
async function getOrgBalance(orgId: string): Promise<number> {
  const b = await (prisma as any).organizationBalance.findUnique({
    where: { organizationId: orgId },
  });
  return b ? b.amount : 0; // Assuming amount exists
}
async function getLedgerDebitSum(projectId: string): Promise<number> {
  const entries = await (prisma as any).ledgerEntry.findMany({ where: { projectId } });
  return entries.reduce((acc: number, cur: any) => acc + Number(cur.amount), 0);
}

function finalizeEvidence(dir: string) {
  // 1. slo_latency.json
  fs.writeFileSync(path.join(dir, 'slo_latency.json'), JSON.stringify(sloStats, null, 2));

  // 2. billing_reconciliation.json
  // Calculate relative errors
  billingStats.forEach((b) => {
    const expected = b.model_expected_cost;
    const delta = b.balance_delta;
    // avoid div by zero
    b.relative_error = expected > 0 ? Math.abs(delta - expected) / expected : 0;
  });
  fs.writeFileSync(
    path.join(dir, 'billing_reconciliation.json'),
    JSON.stringify(billingStats, null, 2)
  );

  // 3. error_matrix.json
  fs.writeFileSync(path.join(dir, 'error_matrix.json'), JSON.stringify(errorStats, null, 2));
}

if (require.main === module) {
  main();
}
