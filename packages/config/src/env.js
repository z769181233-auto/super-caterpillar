"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var path = require("path");
var dotenv = require("dotenv");
// 优先加载仓库根目录的 .env
dotenv.config({
    path: path.resolve(__dirname, '../../..', '.env'),
});
/**
 * 环境变量配置模块
 * 提供类型安全的环境变量读取
 */
function getEnv(key, defaultValue) {
    var value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error("Environment variable ".concat(key, " is required but not set"));
    }
    return value;
}
function getEnvNumber(key, defaultValue) {
    var value = getEnv(key, defaultValue === null || defaultValue === void 0 ? void 0 : defaultValue.toString());
    var num = parseInt(value, 10);
    if (isNaN(num)) {
        throw new Error("Environment variable ".concat(key, " must be a number"));
    }
    return num;
}
exports.env = {
    // Node Environment
    nodeEnv: getEnv('NODE_ENV', 'development'),
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    // Database
    databaseUrl: getEnv('DATABASE_URL'),
    // Redis
    redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),
    // API
    apiPort: getEnvNumber('API_PORT', 3000),
    apiHost: getEnv('API_HOST', 'localhost'),
    // JWT
    jwtSecret: getEnv('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    jwtRefreshSecret: getEnv('JWT_REFRESH_SECRET', 'your-super-secret-refresh-key-change-in-production'),
    jwtRefreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
    // Application
    appName: getEnv('APP_NAME', 'Super Caterpillar Universe'),
    appVersion: getEnv('APP_VERSION', '1.0.0'),
    // Frontend
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3001'),
    // Security
    bcryptSaltRounds: getEnvNumber('BCRYPT_SALT_ROUNDS', 10),
    // Job Worker
    jobWorkerEnabled: process.env.JOB_WORKER_ENABLED === 'true', // 默认禁用，需要显式设置为 'true' 才启用
    jobWorkerInterval: Number((_a = process.env.JOB_WORKER_INTERVAL) !== null && _a !== void 0 ? _a : '5000'), // 轮询间隔（毫秒），默认 5 秒
    jobWorkerBatchSize: Number((_b = process.env.JOB_WORKER_BATCH_SIZE) !== null && _b !== void 0 ? _b : '10'), // 每次处理的任务数，默认 10
    // Engine
    engineDefault: (_c = process.env.ENGINE_DEFAULT) !== null && _c !== void 0 ? _c : 'mock', // 默认使用的引擎
    engineRealHttpBaseUrl: (_d = process.env.ENGINE_REAL_HTTP_BASE_URL) !== null && _d !== void 0 ? _d : 'http://localhost:8000', // 真实 HTTP 引擎基础 URL
    // HMAC Authentication
    // HMAC_TIMESTAMP_WINDOW: 时间戳允许的误差范围（毫秒），默认 5 分钟
    HMAC_TIMESTAMP_WINDOW: getEnvNumber('HMAC_TIMESTAMP_WINDOW', 300000),
    // HMAC_SIGNATURE_ALGORITHM: 签名算法，默认 sha256
    HMAC_SIGNATURE_ALGORITHM: getEnv('HMAC_SIGNATURE_ALGORITHM', 'sha256'),
};
