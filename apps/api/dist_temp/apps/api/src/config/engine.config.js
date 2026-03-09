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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var EngineConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@scu/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let EngineConfigService = EngineConfigService_1 = class EngineConfigService {
    logger = new common_1.Logger(EngineConfigService_1.name);
    enginesConfigCache = null;
    getHttpEngineConfig(engineKey) {
        const engineKeyUpper = engineKey.toUpperCase().replace(/-/g, '_');
        const engineEnvBaseUrl = process.env[`HTTP_ENGINE_${engineKeyUpper}_BASE_URL`];
        const engineEnvApiKey = process.env[`HTTP_ENGINE_${engineKeyUpper}_API_KEY`];
        const engineEnvTimeout = process.env[`HTTP_ENGINE_${engineKeyUpper}_TIMEOUT_MS`];
        const engineEnvConnectTimeout = process.env[`HTTP_ENGINE_${engineKeyUpper}_CONNECT_TIMEOUT_MS`];
        const engineEnvPath = process.env[`HTTP_ENGINE_${engineKeyUpper}_PATH`];
        const engineEnvAuthMode = process.env[`HTTP_ENGINE_${engineKeyUpper}_AUTH_MODE`];
        const engineEnvApiKeyHeader = process.env[`HTTP_ENGINE_${engineKeyUpper}_API_KEY_HEADER`];
        const engineEnvMaxBodyMb = process.env[`HTTP_ENGINE_${engineKeyUpper}_MAX_BODY_MB`];
        const engineEnvHmacKeyId = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_KEY_ID`];
        const engineEnvHmacSecret = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_SECRET`];
        const engineEnvHmacHeader = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_HEADER`];
        const globalEnvBaseUrl = process.env.HTTP_ENGINE_BASE_URL || process.env.ENGINE_HTTP_BASE_URL;
        const globalEnvApiKey = process.env.HTTP_ENGINE_API_KEY || process.env.ENGINE_HTTP_AUTH_TOKEN;
        const globalEnvTimeout = process.env.HTTP_ENGINE_TIMEOUT_MS || process.env.ENGINE_HTTP_TIMEOUT_MS;
        const globalEnvConnectTimeout = process.env.HTTP_ENGINE_CONNECT_TIMEOUT_MS;
        const globalEnvPath = process.env.HTTP_ENGINE_PATH || process.env.ENGINE_HTTP_PATH;
        const globalEnvAuthMode = process.env.HTTP_ENGINE_AUTH_MODE;
        const globalEnvApiKeyHeader = process.env.HTTP_ENGINE_API_KEY_HEADER;
        const globalEnvMaxBodyMb = process.env.HTTP_ENGINE_MAX_BODY_MB;
        const globalEnvHmacKeyId = process.env.HTTP_ENGINE_HMAC_KEY_ID;
        const globalEnvHmacSecret = process.env.HTTP_ENGINE_HMAC_SECRET;
        const globalEnvHmacHeader = process.env.HTTP_ENGINE_HMAC_HEADER;
        const jsonConfig = this.findEngineConfigByKey(engineKey);
        const baseUrl = engineEnvBaseUrl ||
            globalEnvBaseUrl ||
            jsonConfig?.httpConfig?.baseUrl ||
            config_1.env.engineRealHttpBaseUrl ||
            'http://localhost:8000';
        const timeoutMs = parseInt(engineEnvTimeout || globalEnvTimeout || String(jsonConfig?.httpConfig?.timeoutMs || 30000), 10);
        const connectTimeoutMs = engineEnvConnectTimeout
            ? parseInt(engineEnvConnectTimeout, 10)
            : globalEnvConnectTimeout
                ? parseInt(globalEnvConnectTimeout, 10)
                : jsonConfig?.httpConfig?.connectTimeoutMs;
        const pathValue = engineEnvPath || globalEnvPath || jsonConfig?.httpConfig?.path || '/invoke';
        const maxBodyMb = engineEnvMaxBodyMb
            ? parseFloat(engineEnvMaxBodyMb)
            : globalEnvMaxBodyMb
                ? parseFloat(globalEnvMaxBodyMb)
                : jsonConfig?.httpConfig?.maxBodyMb;
        const authMode = engineEnvAuthMode ||
            globalEnvAuthMode ||
            jsonConfig?.httpConfig?.authMode ||
            (engineEnvApiKey || globalEnvApiKey ? 'bearer' : 'none');
        const apiKey = engineEnvApiKey || globalEnvApiKey;
        const apiKeyHeader = engineEnvApiKeyHeader ||
            globalEnvApiKeyHeader ||
            jsonConfig?.httpConfig?.apiKeyHeader ||
            'X-API-Key';
        let hmac;
        if (authMode === 'hmac') {
            const hmacKeyId = engineEnvHmacKeyId || globalEnvHmacKeyId;
            const hmacSecret = engineEnvHmacSecret || globalEnvHmacSecret;
            if (hmacKeyId && hmacSecret) {
                hmac = {
                    keyId: hmacKeyId,
                    secret: hmacSecret,
                    algorithm: 'sha256',
                    header: engineEnvHmacHeader || globalEnvHmacHeader || 'X-Signature',
                };
            }
        }
        this.validateHttpEngineConfig(baseUrl, timeoutMs, pathValue, authMode, apiKey, hmac);
        const config = {
            baseUrl,
            timeoutMs,
            path: pathValue,
            authMode,
            apiKey,
            apiKeyHeader,
            hmac,
        };
        if (connectTimeoutMs) {
            config.connectTimeoutMs = connectTimeoutMs;
        }
        if (maxBodyMb) {
            config.maxBodyMb = maxBodyMb;
        }
        return config;
    }
    loadEngineConfigsFromJson() {
        if (this.enginesConfigCache !== null) {
            return this.enginesConfigCache;
        }
        try {
            const possiblePaths = [
                path.join(process.cwd(), 'config', 'engines.json'),
                path.join(process.cwd(), 'apps', 'api', 'config', 'engines.json'),
                path.join(__dirname, '..', '..', 'config', 'engines.json'),
            ];
            let configPath = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    configPath = p;
                    break;
                }
            }
            if (!configPath) {
                this.logger.warn('engines.json not found, using default configuration');
                this.enginesConfigCache = [];
                return [];
            }
            const fileContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(fileContent);
            const processedEngines = config.engines.map((engine) => {
                if (engine.httpConfig) {
                    if (engine.httpConfig.baseUrl &&
                        engine.httpConfig.baseUrl.startsWith('${') &&
                        engine.httpConfig.baseUrl.endsWith('}')) {
                        const envVar = engine.httpConfig.baseUrl.slice(2, -1);
                        engine.httpConfig.baseUrl = process.env[envVar] || engine.httpConfig.baseUrl;
                    }
                }
                return engine;
            });
            this.enginesConfigCache = processedEngines;
            this.logger.log(`Loaded ${processedEngines.length} engine configs from ${configPath}`);
            return processedEngines;
        }
        catch (error) {
            this.logger.error(`Failed to load engines.json: ${error instanceof Error ? error.message : String(error)}`);
            this.enginesConfigCache = [];
            return [];
        }
    }
    findEngineConfigByKey(engineKey) {
        const configs = this.loadEngineConfigsFromJson();
        return configs.find((c) => c.engineKey === engineKey && c.enabled !== false) || null;
    }
    validateHttpEngineConfig(baseUrl, timeoutMs, pathValue, authMode, apiKey, hmac) {
        if (!baseUrl || baseUrl.trim() === '') {
            throw new Error('HTTP_ENGINE_BASE_URL is required but not set');
        }
        try {
            new URL(baseUrl);
        }
        catch {
            throw new Error(`Invalid HTTP_ENGINE_BASE_URL format: ${baseUrl}`);
        }
        if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
            throw new Error(`HTTP_ENGINE_TIMEOUT_MS must be a positive integer, got: ${timeoutMs}`);
        }
        if (pathValue && !pathValue.startsWith('/')) {
            throw new Error(`HTTP_ENGINE_PATH must start with '/', got: ${pathValue}`);
        }
        if ((authMode === 'bearer' || authMode === 'apiKey') && (!apiKey || apiKey.trim() === '')) {
            throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is '${authMode}'`);
        }
        if (authMode === 'hmac' && !hmac) {
            throw new Error(`HTTP_ENGINE_HMAC_SECRET is required when authMode is 'hmac'`);
        }
        if (config_1.env.isProduction && authMode === 'none' && baseUrl.startsWith('https://')) {
            this.logger.warn(`Security warning: authMode='none' is not allowed in production for HTTPS endpoints. engineKey may be misconfigured.`);
        }
    }
    clearCache() {
        this.enginesConfigCache = null;
    }
};
exports.EngineConfigService = EngineConfigService;
exports.EngineConfigService = EngineConfigService = EngineConfigService_1 = __decorate([
    (0, common_1.Injectable)()
], EngineConfigService);
//# sourceMappingURL=engine.config.js.map