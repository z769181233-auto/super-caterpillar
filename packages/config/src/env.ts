import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as util from 'util';

// 加载环境变量文件（按优先级顺序）
// 规则：
// 1. process.env (Shell/Docker/CI 注入) 具有最高优先级，任何文件不得覆盖它。
// 2. 如果设置了 IGNORE_ENV_FILE=true，则不加载任何 .env 文件。
// 3. .env 文件作为基础配置。
// 4. .env.local 仅在非 CI 环境且 NODE_ENV=development 时加载。

const ignoreEnvFile = process.env.IGNORE_ENV_FILE === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';
const isCI = !!process.env.CI;

// Loaded via dotenv.config() logic below

let dbUrlSource = 'environment variable';

if (!ignoreEnvFile) {
  const root = path.resolve(__dirname, '../../..');
  const envPath = path.join(root, '.env');
  const envLocalPath = path.join(root, '.env.local');

  // .env.local 具有最高优先级，先加载且允许覆盖（确保本地开发配置生效）
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
    if (!process.env.DATABASE_URL_SET_BY_SYSTEM) {
      dbUrlSource = '.env.local file';
    }
  }

  // .env 作为基础配置（不覆盖已从 Shell 或 .env.local 加载的变量）
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    if (dbUrlSource === 'environment variable' && !process.env.DATABASE_URL_SET_BY_SYSTEM) {
      dbUrlSource = '.env file';
    }
  }
} else {
  // eslint-disable-next-line no-console
  process.stdout.write(
    util.format('[Config] IGNORE_ENV_FILE=true, strictly skipping all .env files.') + '\n'
  );
}

// DATABASE_URL source tracking (silent)

/**
 * 环境变量配置模块
 * 提供类型安全的环境变量读取
 */
function getEnv(key: string, defaultValue?: string, requiredInProduction = false): string {
  const value = process.env[key];
  const isProduction = process.env.NODE_ENV === 'production';

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // P0 SEALed: Fail-fast if missing and no default, regardless of NODE_ENV
    throw new Error(`[CONFIG_FATAL] Environment variable ${key} is required but missing.`);
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

function requiresWorkerIdentity(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return false;
  }

  return (
    process.env.JOB_WORKER_ENABLED === 'true' ||
    process.env.ENABLE_INTERNAL_JOB_WORKER === 'true' ||
    Boolean(process.env.WORKER_API_SECRET) ||
    process.argv.some((arg) => arg.toLowerCase().includes('worker'))
  );
}

// JWT Secret Check (Silent)

export const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';

export interface AppConfig {
  productionMode: boolean;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  workerHeartbeatTimeoutMs: number;
  jobWatchdogEnabled: boolean;
  jobWatchdogTimeoutMs: number;
  databaseUrl: string;
  redisUrl: string;
  apiPort: number;
  apiHost: string;
  apiUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  appName: string;
  appVersion: string;
  frontendUrl: string;
  bcryptSaltRounds: number;
  enableInternalJobWorker: boolean;
  jobWorkerInterval: number;
  jobWorkerBatchSize: number;
  workerApiKey?: string;
  workerApiSecret?: string;
  workerId: string;
  workerName: string;
  workerPollInterval: number;
  jobWorkerEnabled: boolean;
  engineDefault: string;
  engineRealHttpBaseUrl: string;
  HMAC_TIMESTAMP_WINDOW: number;
  HMAC_SIGNATURE_ALGORITHM: string;
  concurrencyLimiterEnabled: boolean;
  apiBackpressureEnabled: boolean;
  execTimeoutEnabled: boolean;
  retryPolicyEnabled: boolean;
  maxInFlightTotal: number;
  maxInFlightTenant: number;
  getEngineConcurrency: (engineKey: string) => number;
  apiQueuePendingLimit: number;
  apiQueueRunningLimit: number;
  apiRetryAfterSeconds: number;
  getEngineTimeoutSeconds: (engineKey: string) => number;
  retryMaxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  retryJitter: boolean;
  jobMaxInFlight: number;
  jobWaveSize: number;
  jobBackpressureThreshold: number;
  jobLeaseTtlMs: number;
  workerOfflineGraceMs: number;
  storageRoot: string;
  ce23RealForceDisable: boolean;
  orchV2AudioEnabled: boolean;
  repoRoot: string;
}

export const env: AppConfig = {
  // Production Mode Flag
  productionMode: PRODUCTION_MODE,

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
  databaseUrl: getEnv('DATABASE_URL'),

  // Redis
  redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),

  // API
  apiPort: getEnvNumber('API_PORT', 3000),
  apiHost: getEnv('API_HOST', 'localhost'),
  apiUrl:
    process.env.API_BASE_URL ||
    process.env.API_URL ||
    `http://${getEnv('API_HOST', 'localhost')}:${getEnvNumber('API_PORT', 3000)}`,

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
    if (!id) {
      if (requiresWorkerIdentity()) {
        throw new Error('[Strict] WORKER_ID / WORKER_NAME environment variable is required.');
      }
      return '__non_worker_context__';
    }
    return id;
  })(),
  workerName: (() => {
    const name = (process.env.WORKER_NAME || process.env.WORKER_ID || '').trim();
    if (!name) {
      if (requiresWorkerIdentity()) {
        throw new Error('[Strict] WORKER_NAME / WORKER_ID environment variable is required.');
      }
      return '__non_worker_context__';
    }
    return name;
  })(),
  workerPollInterval: Number(process.env.WORKER_POLL_INTERVAL ?? '2000'),
  // Worker Job Processing (必须显式设置为 'true' 才启用)
  jobWorkerEnabled: process.env.JOB_WORKER_ENABLED === 'true',

  // Engine
  engineDefault: getEnv('ENGINE_DEFAULT'), // P0: Strict from env or authoritative router
  engineRealHttpBaseUrl: process.env.ENGINE_REAL_HTTP_BASE_URL ?? 'http://localhost:8000', // 真实 HTTP 引擎基础 URL

  // HMAC Authentication
  // HMAC_TIMESTAMP_WINDOW: 时间戳允许的误差范围（毫秒），默认 5 分钟
  HMAC_TIMESTAMP_WINDOW: getEnvNumber('HMAC_TIMESTAMP_WINDOW', 300000),
  // HMAC_SIGNATURE_ALGORITHM: 签名算法，默认 sha256
  HMAC_SIGNATURE_ALGORITHM: getEnv('HMAC_SIGNATURE_ALGORITHM', 'sha256'),

  // --- P1-1: 并发与队列治理 (Concurrency Governance) ---
  concurrencyLimiterEnabled: process.env.CONCURRENCY_LIMITER_ENABLED === 'true',
  apiBackpressureEnabled: process.env.API_BACKPRESSURE_ENABLED === 'true',
  execTimeoutEnabled: process.env.EXEC_TIMEOUT_ENABLED === 'true',
  retryPolicyEnabled: process.env.RETRY_POLICY_ENABLED === 'true',

  // 并发参数
  maxInFlightTotal: getEnvNumber('MAX_IN_FLIGHT_TOTAL', 8),
  maxInFlightTenant: getEnvNumber('MAX_IN_FLIGHT_TENANT', 2),

  // 引擎并发：从环境变量动态读取或使用默认值
  getEngineConcurrency: (engineKey: string): number => {
    const envKey = `MAX_IN_FLIGHT_ENGINE_${engineKey.toUpperCase()}`;
    return Number(process.env[envKey] ?? '2');
  },

  // 背壓閾值
  apiQueuePendingLimit: getEnvNumber('API_QUEUE_PENDING_LIMIT', 100),
  apiQueueRunningLimit: getEnvNumber('API_QUEUE_RUNNING_LIMIT', 50),
  apiRetryAfterSeconds: getEnvNumber('API_RETRY_AFTER_SECONDS', 15),

  // 超時控制 (按 engineKey)
  getEngineTimeoutSeconds: (engineKey: string): number => {
    const envKey = `TIMEOUT_SECONDS_${engineKey.toUpperCase()}`;
    const defaultVal = engineKey === 'shot_render' ? 120 : engineKey === 'video_merge' ? 60 : 180;
    return Number(process.env[envKey] ?? defaultVal);
  },

  // 重試策略
  retryMaxAttempts: getEnvNumber('RETRY_MAX_ATTEMPTS', 3),
  retryBaseMs: getEnvNumber('RETRY_BASE_MS', 500),
  retryMaxMs: getEnvNumber('RETRY_MAX_MS', 5000),
  retryJitter: process.env.RETRY_JITTER !== 'false',

  // JOB_MAX_IN_FLIGHT: 全局或單 Worker 最大併發限制
  jobMaxInFlight: (() => {
    const val = getEnvNumber('JOB_MAX_IN_FLIGHT', 10);
    if (val < 1) throw new Error('JOB_MAX_IN_FLIGHT must be >= 1');
    return val;
  })(),
  // JOB_WAVE_SIZE: 任務觸發/認領波次大小
  jobWaveSize: (() => {
    const val = getEnvNumber('JOB_WAVE_SIZE', 5);
    if (val < 1) throw new Error('JOB_WAVE_SIZE must be >= 1');
    return val;
  })(),
  // JOB_BACKPRESSURE_THRESHOLD: 背壓觸發閾值（in-flight / max）
  jobBackpressureThreshold: (() => {
    const val = parseFloat(getEnv('JOB_BACKPRESSURE_THRESHOLD', '0.8'));
    if (isNaN(val) || val <= 0 || val > 1)
      throw new Error('JOB_BACKPRESSURE_THRESHOLD must be between (0, 1]');
    return val;
  })(),
  // JOB_LEASE_TTL_MS: 任務租約時長（毫秒），超時可被回收
  jobLeaseTtlMs: getEnvNumber('JOB_LEASE_TTL_MS', 120000), // 默認 2 分鐘
  // WORKER_OFFLINE_GRACE_MS: Worker 判定離線的寬限期
  workerOfflineGraceMs: getEnvNumber('WORKER_OFFLINE_GRACE_MS', 180000), // 默認 3 分鐘

  // P5-Fix: Robust STORAGE_ROOT (Relative to Absolute)
  storageRoot: (() => {
    const raw = (process.env.STORAGE_ROOT || '.data/storage') as string;
    if (path.isAbsolute(raw)) return raw;
    // Resolve relative to project root (3 levels up from packages/config/src)
    return path.resolve(__dirname, '../../..', raw);
  })() as string,

  ce23RealForceDisable: process.env.CE23_REAL_FORCE_DISABLE === '1',
  orchV2AudioEnabled: process.env.ORCH_V2_AUDIO_ENABLED === '1', // [A5 FIX] Remove forced true

  // Repository Root (Calculated)
  repoRoot: path.resolve(__dirname, '../../..'),
};

/**
 * [A4] Environment Integrity Guard
 * 启动时强制校验必需的环境变量，缺失则抛出异常并阻止启动。
 */
export function validateRequiredEnvs() {
  const isProd = process.env.NODE_ENV === 'production';
  const isStubMode = process.env.P9_B3_STUB_MODE === '1';
  const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];

  if (isProd) {
    requiredKeys.push('REPLICATE_API_TOKEN');
  }

  const missing = requiredKeys.filter((key) => !process.env[key]);

  // 检查 HMAC Secret
  try {
    pickHmacSecretSSOT();
  } catch (e) {
    missing.push('HMAC_SECRET_KEY');
  }

  if (missing.length > 0) {
    const errorMsg = `[CONFIG_ERROR] Missing required environment variables: ${missing.join(', ')}`;

    if (isProd && !isStubMode) {
      // 商业级严格口径：生产环境且未显式开启 Stub 模式，必须失败退出
      // eslint-disable-next-line no-console
      console.error(`${errorMsg}. Service will exit to prevent inconsistent state.`);
      process.exit(1);
    }

    // [A5_FIX] Strictly prohibit silent internal protocols in any mode
    throw new Error(errorMsg);
  } else {
    // eslint-disable-next-line no-console
    console.log('[Config] Environment Integrity Check: PASS ✅');
    (process as any).missingEnvs = [];
  }
}

/**
 * P0-1: HMAC Secret SSOT (Single Source of Truth)
 * 统一变量名与加载优先级，禁止代码硬编码。
 * 优先级：HMAC_SECRET_KEY > API_SECRET_KEY > WORKER_API_SECRET
 */
export function pickHmacSecretSSOT(): string {
  const v =
    process.env.HMAC_SECRET_KEY || process.env.API_SECRET_KEY || process.env.WORKER_API_SECRET;

  if (!v) {
    throw new Error('HMAC_SECRET_MISSING: Please set HMAC_SECRET_KEY in environment or .env.local');
  }

  // Deprecation warnings (do not block)
  if (!process.env.HMAC_SECRET_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      '[WARN] HMAC_SECRET_KEY missing; fallback to legacy env used. Please migrate to HMAC_SECRET_KEY.'
    );
  }

  return v;
}
