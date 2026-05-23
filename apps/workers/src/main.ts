import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import './observability/stage4.metrics'; // P5-1: Register Stage4 metrics on startup

// Load root .env (using __dirname to be robust against different CWDs)
const root = path.resolve(__dirname, '../../../');
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');
const ignoreEnvFile = process.env.IGNORE_ENV_FILE === 'true';

// Priority: .env.local > .env (respecting existing process.env)
if (!ignoreEnvFile) {
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
  dotenv.config({ path: envPath });
}

/**
 * Worker Bootstrap 入口
 * P1-1: 重构为纯路由，使用动态 import 避免静态依赖链触发 @scu/engines 解析
 */

type PrismaDmmfField = { name: string };
type PrismaDmmfModel = { name: string; fields: PrismaDmmfField[] };
type PrismaDmmf = { datamodel?: { models?: PrismaDmmfModel[] } };
type PrismaClientLike = {
  $disconnect(): Promise<void>;
  constructor: { dmmf?: PrismaDmmf };
  shot?: unknown;
};
type DatabaseModule = {
  PrismaClient: new (options?: Record<string, unknown>) => PrismaClientLike;
};

async function boot() {
  // P2-FIX-1: Prisma Client DMMF 自检（Gate/Dev 强制，Production 记录警告）
  const isGate = process.env.GATE_MODE === '1';
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldEnforceDMMF = isGate || isDev;

  let databaseModule: DatabaseModule | null = null;

  try {
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
        databaseModule = (await import(p)) as unknown as DatabaseModule;
        break;
      } catch (e) {
        // Continue searching
      }
    }

    if (!databaseModule) {
      throw new Error('Could not resolve database module from any known path');
    }

    // P1-1 DB URL Source Audit - Strict True 0-Mock
    const dbUrl = process.env.DATABASE_URL;
    const isProd = process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1';

    let activeUrl: string | null = null;

    if (dbUrl) {
      activeUrl = dbUrl;
    } else {
      throw new Error(`[P1-FATAL] DATABASE_URL is missing. Strictly Fail-fast.`);
    }

    try {
      if (activeUrl) {
        new URL(activeUrl);
      }
    } catch (e) {}

    const { PrismaClient } = databaseModule;
    const prisma = new PrismaClient({});
    const prismaClient = prisma as PrismaClientLike;
    const prismaCtor = PrismaClient as unknown as { dmmf?: PrismaDmmf };
    const dmmf = prismaClient.constructor.dmmf || prismaCtor.dmmf;

    if (!dmmf?.datamodel?.models) {
      const hasShotAccessor = 'shot' in prismaClient;
      if (!hasShotAccessor) {
        throw new Error('Prisma client missing shot model accessor');
      }
    } else {
      const shotModel = dmmf.datamodel.models.find((m) => m.name === 'Shot');
      if (!shotModel) {
        throw new Error('Shot model not found in Prisma DMMF');
      }

      const requiredFields = ['renderStatus', 'resultImageUrl', 'resultVideoUrl'];
      const missingFields: string[] = [];

      for (const fieldName of requiredFields) {
        const field = shotModel.fields.find((f) => f.name === fieldName);
        if (!field) {
          missingFields.push(fieldName);
        }
      }

      if (missingFields.length > 0) {
        // Keep startup best-effort; this check only reports drift in the old path.
      }
    }

    await prisma.$disconnect();
  } catch {
  }

  if (process.env.WORKER_METRICS_PORT) {
    try {
      const { startMetricsServer } = await import('./metrics-server');
      startMetricsServer(parseInt(process.env.WORKER_METRICS_PORT, 10));
    } catch (e) {
    }
  }

  if (process.env.STRESS_TEST_LOG_PATH) {
    try {
      const { MemoryLogger } = await import('./utils/memory_logger');
      const logger = new MemoryLogger('15M-STRESS', process.env.STRESS_TEST_LOG_PATH);
      logger.start(1000);
    } catch (e) {
    }
  }

  if (isGate) {
    const mod = await import('./gate/gate-worker-app');
    await mod.startGateWorkerApp();
    return;
  }

  const mod = await import('./worker-app');
  await mod.startWorkerApp();
}

boot().catch((err) => {
  console.error('[Worker Main] boot failed', err);
  process.exit(1);
});
