import { PrismaClient, ProjectStatus } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../../apps/workers/src/api-client';

export async function runCoreMvpReal(ctx: { evidenceDir: string; args: string[] }) {
  const { evidenceDir, args } = ctx;
  const isScaleMode = args.includes('--scale');
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency'));
  const concurrency = parseInt(
    concurrencyArg ? concurrencyArg.split('=')[1] || args[args.indexOf('--concurrency') + 1] : '1',
    10
  );

  if (isScaleMode) {
    await runScaleBench(evidenceDir, concurrency);
  } else {
    console.log('Only scale mode is supported for now.');
  }
}

async function runScaleBench(evidenceDir: string, concurrency: number = 1) {
  console.log(`--- [PROD-RUNNER] Starting Scale Concurrency Bench (N=${concurrency}) ---`);
  const prisma = new PrismaClient();
  const projectIds = Array.from(
    { length: concurrency },
    (_, i) => `scale_bench_${Date.now()}_${i}`
  );

  console.log('[Dispatcher] Sequential Setup...');
  try {
    await (prisma.organization as any).upsert({
      where: { id: 'org_scale_test' },
      create: { id: 'org_scale_test', name: 'Scale Test Org', ownerId: 'owner_scale_test' },
      update: {},
    });
    await (prisma.user as any).upsert({
      where: { id: 'owner_scale_test' },
      create: { id: 'owner_scale_test', email: 'scale@test.com', passwordHash: 'nopass' },
      update: {},
    });
    for (const pid of projectIds) {
      await prisma.project.upsert({
        where: { id: pid },
        create: {
          id: pid,
          ownerId: 'owner_scale_test',
          organizationId: 'org_scale_test',
          name: `Scale Project ${pid}`,
          status: ProjectStatus.in_progress,
        },
        update: {},
      });
    }
  } catch (e: any) {
    console.error('[Dispatcher] Setup Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`[Dispatcher] Spawning ${concurrency} creation tasks...`);
  const apiClient = new ApiClient(
    'http://localhost:3000',
    'dev-worker-key',
    'dev-worker-secret',
    'concurrency-auditor'
  );
  const startTime = Date.now();

  const tasks = projectIds.map(async (pid) => {
    try {
      const res = await apiClient.createJob({
        jobType: 'CE06_NOVEL_PARSING',
        projectId: pid,
        organizationId: 'org_scale_test',
        payload: { sourceText: 'Scale Test Content' },
      });
      return { success: true, projectId: pid, jobId: res.id };
    } catch (err: any) {
      console.error(`[Project-${pid}] Failed:`, err.message);
      return { success: false, projectId: pid, error: err.message };
    }
  });

  const results = await Promise.all(tasks);
  const duration = Date.now() - startTime;

  const report = {
    timestamp: new Date().toISOString(),
    concurrency,
    duration_ms: duration,
    success_count: results.filter((r) => r.success).length,
    results,
  };
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'concurrency_perf.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(`--- [PROD-RUNNER] Finished --- Duration: ${duration}ms`);
}
