import { RedisService } from '../../apps/api/src/redis/redis.service';
import { ShotPreviewFastAdapter } from '../../apps/api/src/engines/adapters/shot_preview.fast.adapter';
import { ShotRenderRouterAdapter } from '../../apps/api/src/engines/adapters/shot-render.router.adapter';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

// 1. Stub Local Adapter (Simulates REAL file generation)
class ShotRenderFileStubAdapter implements EngineAdapter {
  name = 'shot_render_local';
  supports(k: string) {
    return true;
  }
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    // Generate real file with PNG header
    const tmpDir = os.tmpdir();
    const fname = `preview_stub_${Date.now()}_${Math.random()}.png`;
    const fpath = path.join(tmpDir, fname);
    // Minimal PNG Header: \x89PNG\r\n\x1a\n + IHDR chunk (basic)
    const pngHeader = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01, // 1x1
      0x08,
      0x06,
      0x00,
      0x00,
      0x00, // bit depth 8, truecolor alpha
      0x1f,
      0x15,
      0xc4,
      0x89, // crc
    ]);
    fs.writeFileSync(fpath, pngHeader);

    return {
      status: 'SUCCESS' as any,
      output: {
        status: 'success',
        url: `file://${fpath}`, // REAL file schema
        assetUrl: `file://${fpath}`,
        render_meta: { model: 'stub_file_gen' },
      },
    };
  }
}

// Mock Billing
const mockBillingService = {
  consumeCredits: async () => true,
  checkBalance: async () => true,
} as any;

async function main() {
  console.log('Initializing Services...');

  // DB & Redis
  const prisma = new PrismaService();
  await prisma.$connect();

  const redis = new RedisService();
  await redis.onModuleInit();

  // Services
  const audit = new AuditService(prisma);
  const cost = new CostLedgerService(prisma, mockBillingService);

  // Dependencies
  const fileStub = new ShotRenderFileStubAdapter();
  const router = new ShotRenderRouterAdapter(
    { get: () => undefined } as any, // ModuleRef mock
    undefined as any, // Replicate
    fileStub as any, // Local (Injected Stub)
    undefined as any // ComfyUI
  );

  // Force Local Provider
  process.env.SHOT_RENDER_PROVIDER = 'local';

  // Target Adapter
  const adapter = new ShotPreviewFastAdapter(redis, router, audit, cost);

  // Setup Context
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `preview_runner_${suffix}@example.com`, passwordHash: 'x' },
  });
  const org = await prisma.organization.create({
    data: { name: `PreviewOrg_${suffix}`, ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: { name: `PreviewProj_${suffix}`, organizationId: org.id, ownerId: user.id },
  });
  const task = await prisma.task.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      type: 'CE_CORE_PIPELINE',
      status: 'RUNNING',
    },
  });
  const job = await prisma.shotJob.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      taskId: task.id,
      type: 'SHOT_RENDER',
      status: 'RUNNING',
      attempts: 1,
    },
  });

  const input: EngineInvokeInput = {
    payload: { prompt: 'Test Real Preview ' + Date.now(), seed: 123, style: 'cine' },
    context: {
      projectId: project.id,
      organizationId: org.id,
      userId: user.id,
      jobId: job.id,
      traceId: `trace_${suffix}`,
      attempt: 1,
    },
    engineKey: 'shot_preview',
    jobType: 'shot_render',
  };

  try {
    console.log('--- Run 1: Cache MISS (Expect Render + File URL) ---');
    const t0 = performance.now();
    const res1 = await adapter.invoke(input);
    const t1 = performance.now();
    console.log(JSON.stringify(res1, null, 2));
    console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

    console.log('--- Run 2: Cache HIT (Expect Cache + Same URL) ---');
    const t2 = performance.now();
    const res2 = await adapter.invoke(input);
    const t3 = performance.now();
    console.log(JSON.stringify(res2, null, 2));
    console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

    // Verify Logic
    let exitCode = 0;

    // 1. Check Source logic
    if (res1.output.source !== 'render') {
      console.error('FAIL: Run 1 source != render');
      exitCode = 1;
    }
    if (res2.output.source !== 'cache') {
      console.error('FAIL: Run 2 source != cache');
      exitCode = 1;
    }

    // 2. Check URL Schema (REAL)
    const url1 = res1.output.url;
    if (!url1 || !url1.startsWith('file://')) {
      console.error('FAIL: Run 1 URL not file:// schema: ' + url1);
      exitCode = 1;
    }
    if (url1.includes('mock')) {
      console.error('FAIL: Run 1 URL contains mock');
      exitCode = 1;
    }

    // 3. Check Audit (Filtered by traceId via details JSON)
    // Note: Prisma JSON path filtering syntax for details field
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'SHOT_PREVIEW',
        details: {
          path: ['traceId'],
          equals: input.context.traceId,
        },
      },
    });
    console.log(`Audit Logs Found: ${auditLogs.length}`);
    if (auditLogs.length !== 2) {
      console.error('FAIL: Expected 2 audit logs');
      exitCode = 1;
    }

    // 4. Check Cost
    const ledgers = await prisma.costLedger.findMany({ where: { jobId: job.id } });
    console.log(`Cost Ledgers Found: ${ledgers.length}`);
    if (ledgers.length < 1) {
      console.error('FAIL: Expected at least 1 cost ledger');
      exitCode = 1;
    } // Hit is 0 cost but might record? Adapter says recordCost(0).

    // Cleanup
    await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
    // Cleanup Audit: Find by traceId then delete (projectId is inside details)
    const runLogs = await prisma.auditLog.findMany({
      where: {
        action: 'SHOT_PREVIEW',
        details: { path: ['traceId'], equals: `trace_${suffix}` },
      },
      select: { id: true },
    });
    if (runLogs.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map((l) => l.id) } } });
    }
    await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: user.id } });

    await prisma.$disconnect();
    await redis.onModuleDestroy();

    if (exitCode === 0) console.log('✅ Runner Logic Verification Passed');
    process.exit(exitCode);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
