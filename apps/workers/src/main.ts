import * as util from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';
import './observability/stage4.metrics'; // P5-1: Register Stage4 metrics on startup

// Load root .env (using __dirname to be robust against different CWDs)
const root = path.resolve(__dirname, '../../../');
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');

// Priority: .env.local > .env (respecting existing process.env)
if (require('fs').existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config({ path: envPath });
// Also try current dir just in case
dotenv.config();

console.log(
  `[Bootstrap] Loaded env from ${root}. SHOT_RENDER_PROVIDER=${process.env.SHOT_RENDER_PROVIDER}`
);

/**
 * Worker Bootstrap 入口
 * P1-1: 重构为纯路由，使用动态 import 避免静态依赖链触发 @scu/engines 解析
 */

async function boot() {
  // P2-FIX-1: Prisma Client DMMF 自检（Gate/Dev 强制，Production 记录警告）
  const isGate = process.env.GATE_MODE === '1';
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldEnforceDMMF = isGate || isDev;

  let databaseModule: any = null;

  try {
    process.stdout.write(util.format('[Bootstrap] Prisma Client DMMF Self-Check...') + '\n');
    process.stdout.write(util.format('[Bootstrap]   process.cwd() = %s', process.cwd()) + '\n');

    // 尝试多种路径加载 database
    const tryPaths = [
      'database',
      path.resolve(process.cwd(), 'node_modules/database'),
      path.resolve(process.cwd(), '../../node_modules/database'),
      path.resolve(__dirname, '../node_modules/database'),
      path.resolve(__dirname, '../../node_modules/database'),
      path.resolve(__dirname, '../../../../node_modules/database'),
    ];

    for (const p of tryPaths) {
      try {
        databaseModule = await import(p);
        process.stdout.write(util.format('[Bootstrap]   ✅ database loaded from: %s', p) + '\n');
        break;
      } catch (e) {
        // Continue searching
      }
    }

    if (!databaseModule) {
      throw new Error('Could not resolve database module from any known path');
    }

    const { PrismaClient } = databaseModule;
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
  }

  if (process.env.WORKER_METRICS_PORT) {
    try {
      const { startMetricsServer } = await import('./metrics-server');
      startMetricsServer(parseInt(process.env.WORKER_METRICS_PORT, 10));
    } catch (e) {
      process.stderr.write(util.format('[Bootstrap] Metrics Server failed: %s', (e as Error).message) + '\n');
    }
  }

  if (process.env.STRESS_TEST_LOG_PATH) {
    try {
      const { MemoryLogger } = await import('./utils/memory_logger');
      const logger = new MemoryLogger('15M-STRESS', process.env.STRESS_TEST_LOG_PATH);
      logger.start(1000);
      process.stdout.write(
        util.format(
          '[Bootstrap] 🚀 MemoryLogger started. Path: %s',
          process.env.STRESS_TEST_LOG_PATH
        ) + '\n'
      );
    } catch (e) {
      process.stderr.write(util.format('[Bootstrap] MemoryLogger failed: %s', (e as Error).message) + '\n');
    }
  }

  if (isGate) {
    process.stdout.write(
      util.format('[Bootstrap] GATE_MODE detected, loading Gate Worker...') + '\n'
    );
    const mod = await import('./gate/gate-worker-app');
    await mod.startGateWorkerApp();
    return;
  }

  const mod = await import('./worker-app');
  await mod.startWorkerApp();
}

boot().catch((err) => {
  // eslint-disable-next-line no-console
  process.stderr.write(util.format('[Bootstrap] Fatal error:', err) + '\n');
  process.exit(1);
});
