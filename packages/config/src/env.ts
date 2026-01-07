import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// 加载环境变量文件（按优先级顺序）
// 规则：
// 1. process.env (Shell/Docker/CI 注入) 具有最高优先级，任何文件不得覆盖它。
// 2. 如果设置了 IGNORE_ENV_FILE=true，则不加载任何 .env 文件。
// 3. .env 文件作为基础配置。
// 4. .env.local 仅在非 CI 环境且 NODE_ENV=development 时加载。

const ignoreEnvFile = process.env.IGNORE_ENV_FILE === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';
const isCI = !!process.env.CI;

let dbUrlSource = 'environment variable';

if (!ignoreEnvFile) {
  const root = path.resolve(__dirname, '../../..');
  const envPath = path.join(root, '.env');
  const envLocalPath = path.join(root, '.env.local');

  // P0-3: 显式禁止 override: true，确保 process.env 具有绝对最高优先级
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    // 注意：由于 override: false，如果不覆盖，DATABASE_URL 不会变
    // 这里我们可以根据读取后的结果判断最终来源（仅用于日志）
    if (!process.env.DATABASE_URL_SET_BY_SYSTEM) {
      // 这是一个启发式判断，不改变逻辑
      dbUrlSource = '.env file';
    }
  }

  // .env.local 仅用于本地开发隔离
  if (isDevelopment && !isCI && fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: false });
    if (!process.env.DATABASE_URL_SET_BY_SYSTEM) {
      dbUrlSource = '.env.local file';
    }
  }
} else {
  // eslint-disable-next-line no-console
  console.log('[Config] IGNORE_ENV_FILE=true, strictly skipping all .env files.');
}

// 判定标记，用于证据化
if (!process.env.DATABASE_URL_SET_BY_SYSTEM) {
  // eslint-disable-next-line no-console
  console.log(`[Config] DATABASE_URL resolved from ${dbUrlSource}`);
} else {
  // eslint-disable-next-line no-console
  console.log(`[Config] DATABASE_URL resolved from environment variable (System Override)`);
}



/**
 * 环境变量配置模块
 * 提供类型安全的环境变量读取
 */
function getEnv(key: string, defaultValue?: string, requiredInProduction = false): string {
  const value = process.env[key];
  const isProduction = process.env.NODE_ENV === 'production';

  if (value === undefined) {
    if (isProduction && requiredInProduction) {
      throw new Error(`[Strict] Environment variable ${key} is required in PRODUCTION`);
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = getEnv(key, defaultValue?.toString());
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

console.log(`[CONFIG_DEBUG] JWT_SECRET read from env: ${process.env.JWT_SECRET?.substring(0, 4)}...`);
export const env = {
  // Node Environment
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Worker
  workerHeartbeatTimeoutMs: getEnvNumber('WORKER_HEARTBEAT_TIMEOUT_MS', 30000), // 默认 30 秒

  // Job Watchdog
  // P1 修复：默认启用看门狗，除非显式禁用 (Safety by Default)
  jobWatchdogEnabled: process.env.JOB_WATCHDOG_ENABLED !== 'false',
  jobWatchdogTimeoutMs: getEnvNumber('JOB_WATCHDOG_TIMEOUT_MS', 3600000), // 默认 1 小时

  // Database
  databaseUrl: getEnv('DATABASE_URL', undefined, true),

  // Redis
  redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379', true),

  // API
  apiPort: getEnvNumber('API_PORT', 3000),
  apiHost: getEnv('API_HOST', 'localhost'),
  apiUrl: process.env.API_BASE_URL || process.env.API_URL || `http://${getEnv('API_HOST', 'localhost')}:${getEnvNumber('API_PORT', 3000)}`,


  // JWT
  jwtSecret: getEnv('JWT_SECRET'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  jwtRefreshSecret: getEnv('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Application
  appName: getEnv('APP_NAME', 'Super Caterpillar Universe'),
  appVersion: getEnv('APP_VERSION', '1.0.0'),

  // Frontend
  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3001'),

  // Security
  bcryptSaltRounds: getEnvNumber('BCRYPT_SALT_ROUNDS', 10),

  // Internal Job Worker (P0-4 Consolidation)
  // 必须显式设置为 'true'，否则默认关闭且不启动。
  enableInternalJobWorker: process.env.ENABLE_INTERNAL_JOB_WORKER === 'true',
  jobWorkerInterval: Number(process.env.JOB_WORKER_INTERVAL ?? '5000'), // 轮询间隔（毫秒），默认 5 秒
  jobWorkerBatchSize: Number(process.env.JOB_WORKER_BATCH_SIZE ?? '10'), // 每次处理的任务数，默认 10

  // Worker API Key（可选，用于 HMAC 认证）
  workerApiKey: process.env.WORKER_API_KEY,
  workerApiSecret: process.env.WORKER_API_SECRET,
  workerId: (() => {
    const id = (process.env.WORKER_ID || process.env.WORKER_NAME || '').trim();
    const isGateRun =
      Object.keys(process.env).some(k => k.endsWith('_GATE_FAIL_ONCE') && process.env[k] === '1') ||
      process.env.HMAC_TRACE === '1';

    // 商业级鲁棒性：只有在 Gate/Trace 模式下且非 API 服务器进程（即 Worker 进程）时才进行硬断言
    const isApiProcess = !!process.env.API_PORT || !!process.env.NEST_APP_NAME || process.env.SERVICE_TYPE === 'api';

    if (isGateRun && !isApiProcess) {
      if (!id) throw new Error('[Strict] WORKER_ID is required in gate/trace mode for Worker');
      if (id === 'local-worker') throw new Error('[Strict] WORKER_ID must not be "local-worker" in gate/trace mode');
    }
    return id || 'local-worker';
  })(),
  workerName: process.env.WORKER_NAME || process.env.WORKER_ID || 'local-worker',
  workerPollInterval: Number(process.env.WORKER_POLL_INTERVAL ?? '2000'),
  // Worker Job Processing (必须显式设置为 'true' 才启用)
  jobWorkerEnabled: process.env.JOB_WORKER_ENABLED === 'true',

  // Engine
  engineDefault: process.env.ENGINE_DEFAULT ?? 'mock', // 默认使用的引擎
  engineRealHttpBaseUrl: process.env.ENGINE_REAL_HTTP_BASE_URL ?? 'http://localhost:8000', // 真实 HTTP 引擎基础 URL

  // HMAC Authentication
  // HMAC_TIMESTAMP_WINDOW: 时间戳允许的误差范围（毫秒），默认 5 分钟
  HMAC_TIMESTAMP_WINDOW: getEnvNumber('HMAC_TIMESTAMP_WINDOW', 300000),
  // HMAC_SIGNATURE_ALGORITHM: 签名算法，默认 sha256
  HMAC_SIGNATURE_ALGORITHM: getEnv('HMAC_SIGNATURE_ALGORITHM', 'sha256'),

  // --- P1-1: 并发与队列治理 (Concurrency Governance) ---
  // JOB_MAX_IN_FLIGHT: 全局或单 Worker 最大并发限制
  jobMaxInFlight: (() => {
    const val = getEnvNumber('JOB_MAX_IN_FLIGHT', 10);
    if (val < 1) throw new Error('JOB_MAX_IN_FLIGHT must be >= 1');
    return val;
  })(),
  // JOB_WAVE_SIZE: 任务触发/认领波次大小
  jobWaveSize: (() => {
    const val = getEnvNumber('JOB_WAVE_SIZE', 5);
    if (val < 1) throw new Error('JOB_WAVE_SIZE must be >= 1');
    return val;
  })(),
  // JOB_BACKPRESSURE_THRESHOLD: 背压触发阈值（in-flight / max）
  jobBackpressureThreshold: (() => {
    const val = parseFloat(getEnv('JOB_BACKPRESSURE_THRESHOLD', '0.8'));
    if (isNaN(val) || val <= 0 || val > 1) throw new Error('JOB_BACKPRESSURE_THRESHOLD must be between (0, 1]');
    return val;
  })(),
  // JOB_LEASE_TTL_MS: 任务租约时长（毫秒），超时可被回收
  jobLeaseTtlMs: getEnvNumber('JOB_LEASE_TTL_MS', 120000), // 默认 2 分钟
  // WORKER_OFFLINE_GRACE_MS: Worker 判定离线的宽限期
  workerOfflineGraceMs: getEnvNumber('WORKER_OFFLINE_GRACE_MS', 180000), // 默认 3 分钟
};











