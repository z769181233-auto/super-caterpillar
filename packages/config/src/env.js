"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = exports.PRODUCTION_MODE = void 0;
exports.validateRequiredEnvs = validateRequiredEnvs;
exports.pickHmacSecretSSOT = pickHmacSecretSSOT;
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const util = __importStar(require("util"));
const ignoreEnvFile = process.env.IGNORE_ENV_FILE === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';
const isCI = !!process.env.CI;
let dbUrlSource = 'environment variable';
if (!ignoreEnvFile) {
    const root = path.resolve(__dirname, '../../..');
    const envPath = path.join(root, '.env');
    const envLocalPath = path.join(root, '.env.local');
    if (fs.existsSync(envLocalPath)) {
        dotenv.config({ path: envLocalPath, override: true });
        if (!process.env.DATABASE_URL_SET_BY_SYSTEM) {
            dbUrlSource = '.env.local file';
        }
    }
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
        if (dbUrlSource === 'environment variable' && !process.env.DATABASE_URL_SET_BY_SYSTEM) {
            dbUrlSource = '.env file';
        }
    }
}
else {
    process.stdout.write(util.format('[Config] IGNORE_ENV_FILE=true, strictly skipping all .env files.') + '\n');
}
function getEnv(key, defaultValue, requiredInProduction = false) {
    const value = process.env[key];
    const isProduction = process.env.NODE_ENV === 'production';
    if (value === undefined) {
        if (isProduction && requiredInProduction) {
            console.warn(`[Mock] Environment variable ${key} is required in PRODUCTION but missing. Returning MOCK.`);
            return `MOCK_${key}`;
        }
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        console.warn(`[Mock] Environment variable ${key} is required but missing. Returning MOCK.`);
        return `MOCK_${key}`;
    }
    return value;
}
function getEnvNumber(key, defaultValue) {
    const value = getEnv(key, defaultValue?.toString());
    const num = parseInt(value, 10);
    if (isNaN(num)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return num;
}
exports.PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
exports.env = {
    productionMode: exports.PRODUCTION_MODE,
    nodeEnv: getEnv('NODE_ENV', 'development'),
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    workerHeartbeatTimeoutMs: getEnvNumber('WORKER_HEARTBEAT_TIMEOUT_MS', 30000),
    jobWatchdogEnabled: process.env.JOB_WATCHDOG_ENABLED !== 'false',
    jobWatchdogTimeoutMs: getEnvNumber('JOB_WATCHDOG_TIMEOUT_MS', 3600000),
    databaseUrl: getEnv('DATABASE_URL', undefined, true),
    redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379', true),
    apiPort: getEnvNumber('API_PORT', 3000),
    apiHost: getEnv('API_HOST', 'localhost'),
    apiUrl: process.env.API_BASE_URL ||
        process.env.API_URL ||
        `http://${getEnv('API_HOST', 'localhost')}:${getEnvNumber('API_PORT', 3000)}`,
    jwtSecret: getEnv('JWT_SECRET'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    jwtRefreshSecret: getEnv('JWT_REFRESH_SECRET'),
    jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
    appName: getEnv('APP_NAME', 'Super Caterpillar Universe'),
    appVersion: getEnv('APP_VERSION', '1.0.0'),
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3001'),
    bcryptSaltRounds: getEnvNumber('BCRYPT_SALT_ROUNDS', 10),
    enableInternalJobWorker: process.env.ENABLE_INTERNAL_JOB_WORKER === 'true',
    jobWorkerInterval: Number(process.env.JOB_WORKER_INTERVAL ?? '5000'),
    jobWorkerBatchSize: Number(process.env.JOB_WORKER_BATCH_SIZE ?? '10'),
    workerApiKey: process.env.WORKER_API_KEY,
    workerApiSecret: process.env.WORKER_API_SECRET,
    workerId: (() => {
        const id = (process.env.WORKER_ID || process.env.WORKER_NAME || '').trim();
        const isGateRun = Object.keys(process.env).some((k) => k.endsWith('_GATE_FAIL_ONCE') && process.env[k] === '1') || process.env.HMAC_TRACE === '1';
        const isApiProcess = !!process.env.API_PORT || !!process.env.NEST_APP_NAME || process.env.SERVICE_TYPE === 'api';
        if (isGateRun && !isApiProcess) {
            if (!id)
                throw new Error('[Strict] WORKER_ID is required in gate/trace mode for Worker');
            if (id === 'local-worker')
                throw new Error('[Strict] WORKER_ID must not be "local-worker" in gate/trace mode');
        }
        return id || 'local-worker';
    })(),
    workerName: process.env.WORKER_NAME || process.env.WORKER_ID || 'local-worker',
    workerPollInterval: Number(process.env.WORKER_POLL_INTERVAL ?? '2000'),
    jobWorkerEnabled: process.env.JOB_WORKER_ENABLED === 'true',
    engineDefault: process.env.ENGINE_DEFAULT ?? 'mock',
    engineRealHttpBaseUrl: process.env.ENGINE_REAL_HTTP_BASE_URL ?? 'http://localhost:8000',
    HMAC_TIMESTAMP_WINDOW: getEnvNumber('HMAC_TIMESTAMP_WINDOW', 300000),
    HMAC_SIGNATURE_ALGORITHM: getEnv('HMAC_SIGNATURE_ALGORITHM', 'sha256'),
    concurrencyLimiterEnabled: process.env.CONCURRENCY_LIMITER_ENABLED === 'true',
    apiBackpressureEnabled: process.env.API_BACKPRESSURE_ENABLED === 'true',
    execTimeoutEnabled: process.env.EXEC_TIMEOUT_ENABLED === 'true',
    retryPolicyEnabled: process.env.RETRY_POLICY_ENABLED === 'true',
    maxInFlightTotal: getEnvNumber('MAX_IN_FLIGHT_TOTAL', 8),
    maxInFlightTenant: getEnvNumber('MAX_IN_FLIGHT_TENANT', 2),
    getEngineConcurrency: (engineKey) => {
        const envKey = `MAX_IN_FLIGHT_ENGINE_${engineKey.toUpperCase()}`;
        return Number(process.env[envKey] ?? '2');
    },
    apiQueuePendingLimit: getEnvNumber('API_QUEUE_PENDING_LIMIT', 100),
    apiQueueRunningLimit: getEnvNumber('API_QUEUE_RUNNING_LIMIT', 50),
    apiRetryAfterSeconds: getEnvNumber('API_RETRY_AFTER_SECONDS', 15),
    getEngineTimeoutSeconds: (engineKey) => {
        const envKey = `TIMEOUT_SECONDS_${engineKey.toUpperCase()}`;
        const defaultVal = engineKey === 'shot_render' ? 120 : engineKey === 'video_merge' ? 60 : 180;
        return Number(process.env[envKey] ?? defaultVal);
    },
    retryMaxAttempts: getEnvNumber('RETRY_MAX_ATTEMPTS', 3),
    retryBaseMs: getEnvNumber('RETRY_BASE_MS', 500),
    retryMaxMs: getEnvNumber('RETRY_MAX_MS', 5000),
    retryJitter: process.env.RETRY_JITTER !== 'false',
    jobMaxInFlight: (() => {
        const val = getEnvNumber('JOB_MAX_IN_FLIGHT', 10);
        if (val < 1)
            throw new Error('JOB_MAX_IN_FLIGHT must be >= 1');
        return val;
    })(),
    jobWaveSize: (() => {
        const val = getEnvNumber('JOB_WAVE_SIZE', 5);
        if (val < 1)
            throw new Error('JOB_WAVE_SIZE must be >= 1');
        return val;
    })(),
    jobBackpressureThreshold: (() => {
        const val = parseFloat(getEnv('JOB_BACKPRESSURE_THRESHOLD', '0.8'));
        if (isNaN(val) || val <= 0 || val > 1)
            throw new Error('JOB_BACKPRESSURE_THRESHOLD must be between (0, 1]');
        return val;
    })(),
    jobLeaseTtlMs: getEnvNumber('JOB_LEASE_TTL_MS', 120000),
    workerOfflineGraceMs: getEnvNumber('WORKER_OFFLINE_GRACE_MS', 180000),
    storageRoot: (() => {
        const raw = (process.env.STORAGE_ROOT || '.runtime');
        if (path.isAbsolute(raw))
            return raw;
        return path.resolve(__dirname, '../../..', raw);
    })(),
    ce23RealForceDisable: process.env.CE23_REAL_FORCE_DISABLE === '1',
    orchV2AudioEnabled: process.env.ORCH_V2_AUDIO_ENABLED === '1' || true,
    repoRoot: path.resolve(__dirname, '../../..'),
};
function validateRequiredEnvs() {
    const isProd = process.env.NODE_ENV === 'production';
    const isStubMode = process.env.P9_B3_STUB_MODE === '1';
    const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
    if (isProd) {
        requiredKeys.push('REPLICATE_API_TOKEN');
    }
    const missing = requiredKeys.filter((key) => !process.env[key]);
    try {
        pickHmacSecretSSOT();
    }
    catch (e) {
        missing.push('HMAC_SECRET_KEY');
    }
    if (missing.length > 0) {
        const errorMsg = `[CONFIG_ERROR] Missing required environment variables: ${missing.join(', ')}`;
        if (isProd && !isStubMode) {
            console.error(`${errorMsg}. Service will exit to prevent inconsistent state.`);
            process.exit(1);
        }
        console.warn(`[WARN] ${errorMsg}. Mocking them as P9_B3_STUB_MODE=${isStubMode}.`);
        missing.forEach(k => {
            process.env[k] = `MOCK_${k}`;
        });
        process.missingEnvs = missing;
    }
    else {
        console.log('[Config] Environment Integrity Check: PASS ✅');
        process.missingEnvs = [];
    }
}
function pickHmacSecretSSOT() {
    const v = process.env.HMAC_SECRET_KEY || process.env.API_SECRET_KEY || process.env.WORKER_API_SECRET;
    if (!v) {
        throw new Error('HMAC_SECRET_MISSING: Please set HMAC_SECRET_KEY in environment or .env.local');
    }
    if (!process.env.HMAC_SECRET_KEY) {
        console.warn('[WARN] HMAC_SECRET_KEY missing; fallback to legacy env used. Please migrate to HMAC_SECRET_KEY.');
    }
    return v;
}
//# sourceMappingURL=env.js.map