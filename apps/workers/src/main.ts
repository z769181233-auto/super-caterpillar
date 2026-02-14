import * as util from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';
import './observability/stage4.metrics'; // P5-1: Register Stage4 metrics on startup

// Load root .env (assuming CWD is apps/workers)
const root = path.resolve(process.cwd(), '../../');
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');

// Priority: .env.local > .env (respecting existing process.env)
if (require('fs').existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config({ path: envPath });
// Also try current dir just in case
dotenv.config();

console.log(`[Bootstrap] Loaded env from ${root}. SHOT_RENDER_PROVIDER=${process.env.SHOT_RENDER_PROVIDER}`);

/**
 * Worker Bootstrap 入口
 * P1-1: 重构为纯路由，使用动态 import 避免静态依赖链触发 @scu/engines 解析
 */

async function boot() {
  // P2-FIX-1: Prisma Client DMMF 自检（Gate/Dev 强制，Production 记录警告）
  const isGate = process.env.GATE_MODE === '1';
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldEnforceDMMF = isGate || isDev;

  try {
    process.stdout.write(util.format('[Bootstrap] Prisma Client DMMF Self-Check...') + '\n');
    process.stdout.write(util.format('[Bootstrap]   process.cwd() = %s', process.cwd()) + '\n');

    let prismaClientPath = '';
    try {
      prismaClientPath = require.resolve('@prisma/client');
      process.stdout.write(
        util.format('[Bootstrap]   @prisma/client resolved to: %s', prismaClientPath) + '\n'
      );
    } catch (e) {
      process.stdout.write(
        util.format('[Bootstrap]   @prisma/client resolve failed: %s', (e as Error).message) + '\n'
      );
    }

    let databasePath = '';
    try {
      databasePath = require.resolve('database');
      process.stdout.write(
        util.format('[Bootstrap]   database resolved to: %s', databasePath) + '\n'
      );
    } catch (e) {
      process.stdout.write(
        util.format('[Bootstrap]   database resolve failed: %s', (e as Error).message) + '\n'
      );
    }

    // Import Prisma and check DMMF
    const { PrismaClient } = await import('database');
    const prisma = new PrismaClient();
    const dmmf = (prisma as any).constructor.dmmf || (PrismaClient as any).dmmf;

    if (!dmmf || !dmmf.datamodel || !dmmf.datamodel.models) {
      throw new Error('Prisma DMMF not available or malformed');
    }

    const shotModel = dmmf.datamodel.models.find((m: any) => m.name === 'Shot');
    if (!shotModel) {
      throw new Error('Shot model not found in Prisma DMMF');
    }

    const requiredFields = ['renderStatus', 'resultImageUrl', 'resultVideoUrl'];
    const missingFields: string[] = [];

    for (const fieldName of requiredFields) {
      const field = shotModel.fields.find((f: any) => f.name === fieldName);
      if (!field) {
        missingFields.push(fieldName);
      }
    }

    if (missingFields.length > 0) {
      const errorMsg = `[Bootstrap] ❌ DMMF Self-Check FAILED: Shot model missing fields: ${missingFields.join(', ')}`;
      process.stderr.write(util.format(errorMsg) + '\n');

      if (shouldEnforceDMMF) {
        process.stderr.write(
          util.format(
            '[Bootstrap] Gate/Dev mode: Continuing with WARNING (SHOT_RENDER jobs will fail if schema mismatch)'
          ) + '\n'
        );
      } else {
        process.stderr.write(
          util.format('[Bootstrap] Production mode: Continuing with WARNING (jobs will fail)') +
          '\n'
        );
      }
    } else {
      process.stdout.write(
        util.format('[Bootstrap] ✅ DMMF Self-Check PASSED: All required Shot fields present') +
        '\n'
      );
    }

    await prisma.$disconnect();
  } catch (error: any) {
    const errorMsg = `[Bootstrap] ❌ DMMF Self-Check ERROR: ${error.message}`;
    process.stderr.write(util.format(errorMsg) + '\n');

    if (shouldEnforceDMMF) {
      process.stderr.write(
        util.format(
          '[Bootstrap] Gate/Dev mode: Continuing with WARNING (CE06/other jobs may still work)'
        ) + '\n'
      );
    } else {
      process.stderr.write(
        util.format('[Bootstrap] Production mode: Continuing with WARNING') + '\n'
      );
    }
  }

  if (process.env.WORKER_METRICS_PORT) {
    const { startMetricsServer } = await import('./metrics-server');
    startMetricsServer(parseInt(process.env.WORKER_METRICS_PORT, 10));
  }

  if (isGate) {
    if (process.env.NODE_ENV === 'production') {
      // Allow for Stage verification
      process.stdout.write(
        util.format('[Bootstrap] WARN: Running GATE_MODE in PRODUCTION environment') + '\n'
      );
    }
    process.stdout.write(
      util.format('[Bootstrap] GATE_MODE detected, loading Gate Worker...') + '\n'
    );
    const mod = await import('./gate/gate-worker-app');
    await mod.startGateWorkerApp();
    return;
  }

  process.stdout.write(util.format('[Bootstrap] Normal mode, loading full Worker...') + '\n');

  const mod = await import('./worker-app');
  await mod.startWorkerApp();
}

boot().catch((err) => {
  // eslint-disable-next-line no-console
  process.stderr.write(util.format('[Bootstrap] Fatal error:', err) + '\n');
  process.exit(1);
});
