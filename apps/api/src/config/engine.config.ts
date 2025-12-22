/**
 * Engine Configuration
 * 引擎配置模块，统一读取 HTTP 引擎相关配置
 * 
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3.6 节（HTTP 引擎适配器）
 * 参考 docs/ENGINE_HTTP_CONFIG.md (S3-A.1)
 */

import { Injectable, Logger } from '@nestjs/common';
import { env } from 'config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * HTTP 认证模式
 */
export type HttpAuthMode = 'none' | 'bearer' | 'apiKey' | 'hmac';

/**
 * HMAC 配置
 */
export interface HttpHmacConfig {
  keyId: string;
  secret: string;
  algorithm: 'sha256';
  header?: string; // 默认 'X-Signature'
}

/**
 * HTTP 引擎配置（HttpEngineConfig）
 * 用于 HttpEngineAdapter 构造 HTTP 请求
 * 参考 docs/ENGINE_HTTP_CONFIG.md 第 5.1 节
 */
export interface HttpEngineConfig {
  baseUrl: string; // HTTP 基础 URL（必填）
  timeoutMs: number; // 超时时间（毫秒，必填）
  connectTimeoutMs?: number; // 连接超时时间（毫秒，可选）
  path?: string; // 调用路径（可选，默认 '/invoke'）
  maxBodyMb?: number; // 最大请求体大小（MB，可选）
  
  // 认证配置
  authMode: HttpAuthMode; // 认证模式
  apiKey?: string; // API Key（用于 bearer 或 apiKey 模式）
  apiKeyHeader?: string; // API Key Header 名称（默认 'X-API-Key'）
  hmac?: HttpHmacConfig; // HMAC 配置（用于 hmac 模式）
}

/**
 * 引擎配置（EngineConfig）
 * 完整的引擎配置结构，用于 JSON 配置文件
 * 参考 docs/ENGINE_HTTP_CONFIG.md 第 5.1 节
 */
export interface EngineConfig {
  engineKey: string; // 引擎标识（必填，唯一）
  adapterName: string; // 适配器名称（必填，如 'http'）
  adapterType: 'local' | 'http'; // 适配器类型（必填）
  
  // HTTP 配置（仅当 adapterType='http' 时使用）
  httpConfig?: {
    baseUrl: string; // HTTP 基础 URL
    path?: string; // 调用路径（默认 '/invoke'）
    timeoutMs?: number; // 超时时间（毫秒，默认 30000）
    connectTimeoutMs?: number; // 连接超时时间（毫秒，可选）
    maxBodyMb?: number; // 最大请求体大小（MB，可选）
    authMode?: HttpAuthMode; // 认证模式（默认从环境变量读取）
    apiKeyHeader?: string; // API Key Header 名称（默认 'X-API-Key'）
    // 注意：apiKey 和 hmac secret 不应出现在 JSON 文件中，只从环境变量读取
  };
  
  // 模型信息（可选，本批次暂不实现）
  modelInfo?: {
    modelName?: string;
    version?: string;
  };
  
  // 默认引擎配置（可选，本批次暂不实现）
  isDefault?: boolean;
  isDefaultForJobTypes?: Record<string, boolean>;
  
  // 启用状态
  enabled: boolean; // 是否启用（默认 true）
  
  // 元数据（可选）
  createdAt?: string;
  updatedAt?: string;
}

/**
 * JSON 配置文件结构
 */
interface EnginesConfigFile {
  engines: EngineConfig[];
}

/**
 * EngineConfigService
 * 提供引擎配置读取服务
 * 参考 docs/ENGINE_HTTP_CONFIG.md 第 3、4、5 节
 */
@Injectable()
export class EngineConfigService {
  private readonly logger = new Logger(EngineConfigService.name);
  private enginesConfigCache: EngineConfig[] | null = null;

  /**
   * 获取 HTTP 引擎配置
   * 配置优先级：环境变量 > JSON 文件 > 硬编码默认值
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 3.1、5.3、5.4 节
   * 
   * @param engineKey 引擎标识
   * @returns HTTP 引擎配置
   */
  getHttpEngineConfig(engineKey: string): HttpEngineConfig {
    // 1. 读取引擎级环境变量（优先级最高）
    const engineKeyUpper = engineKey.toUpperCase().replace(/-/g, '_');
    const engineEnvBaseUrl = process.env[`HTTP_ENGINE_${engineKeyUpper}_BASE_URL`];
    const engineEnvApiKey = process.env[`HTTP_ENGINE_${engineKeyUpper}_API_KEY`];
    const engineEnvTimeout = process.env[`HTTP_ENGINE_${engineKeyUpper}_TIMEOUT_MS`];
    const engineEnvConnectTimeout = process.env[`HTTP_ENGINE_${engineKeyUpper}_CONNECT_TIMEOUT_MS`];
    const engineEnvPath = process.env[`HTTP_ENGINE_${engineKeyUpper}_PATH`];
    const engineEnvAuthMode = process.env[`HTTP_ENGINE_${engineKeyUpper}_AUTH_MODE`] as HttpAuthMode | undefined;
    const engineEnvApiKeyHeader = process.env[`HTTP_ENGINE_${engineKeyUpper}_API_KEY_HEADER`];
    const engineEnvMaxBodyMb = process.env[`HTTP_ENGINE_${engineKeyUpper}_MAX_BODY_MB`];
    const engineEnvHmacKeyId = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_KEY_ID`];
    const engineEnvHmacSecret = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_SECRET`];
    const engineEnvHmacHeader = process.env[`HTTP_ENGINE_${engineKeyUpper}_HMAC_HEADER`];
    
    // 2. 读取全局环境变量（次优先级）
    const globalEnvBaseUrl = process.env.HTTP_ENGINE_BASE_URL || process.env.ENGINE_HTTP_BASE_URL;
    const globalEnvApiKey = process.env.HTTP_ENGINE_API_KEY || process.env.ENGINE_HTTP_AUTH_TOKEN;
    const globalEnvTimeout = process.env.HTTP_ENGINE_TIMEOUT_MS || process.env.ENGINE_HTTP_TIMEOUT_MS;
    const globalEnvConnectTimeout = process.env.HTTP_ENGINE_CONNECT_TIMEOUT_MS;
    const globalEnvPath = process.env.HTTP_ENGINE_PATH || process.env.ENGINE_HTTP_PATH;
    const globalEnvAuthMode = process.env.HTTP_ENGINE_AUTH_MODE as HttpAuthMode | undefined;
    const globalEnvApiKeyHeader = process.env.HTTP_ENGINE_API_KEY_HEADER;
    const globalEnvMaxBodyMb = process.env.HTTP_ENGINE_MAX_BODY_MB;
    const globalEnvHmacKeyId = process.env.HTTP_ENGINE_HMAC_KEY_ID;
    const globalEnvHmacSecret = process.env.HTTP_ENGINE_HMAC_SECRET;
    const globalEnvHmacHeader = process.env.HTTP_ENGINE_HMAC_HEADER;
    
    // 3. 读取 JSON 配置文件（再次优先级）
    const jsonConfig = this.findEngineConfigByKey(engineKey);
    
    // 4. 合并配置（按优先级）
    const baseUrl = engineEnvBaseUrl || globalEnvBaseUrl || jsonConfig?.httpConfig?.baseUrl || env.engineRealHttpBaseUrl || 'http://localhost:8000';
    const timeoutMs = parseInt(
      engineEnvTimeout || globalEnvTimeout || String(jsonConfig?.httpConfig?.timeoutMs || 30000),
      10,
    );
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
    
    // 认证模式：环境变量 > JSON > 默认 'bearer'（如果有 apiKey）或 'none'
    const authMode: HttpAuthMode =
      engineEnvAuthMode || globalEnvAuthMode || jsonConfig?.httpConfig?.authMode || (engineEnvApiKey || globalEnvApiKey ? 'bearer' : 'none');
    
    // API Key：只从环境变量读取，不从 JSON 读取
    const apiKey = engineEnvApiKey || globalEnvApiKey;
    const apiKeyHeader = engineEnvApiKeyHeader || globalEnvApiKeyHeader || jsonConfig?.httpConfig?.apiKeyHeader || 'X-API-Key';
    
    // HMAC 配置：只从环境变量读取
    let hmac: HttpHmacConfig | undefined;
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
    
    // 5. 配置验证
    this.validateHttpEngineConfig(baseUrl, timeoutMs, pathValue, authMode, apiKey, hmac);
    
    const config: HttpEngineConfig = {
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

  /**
   * 从 JSON 配置文件加载引擎配置列表
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 5.2 节
   */
  private loadEngineConfigsFromJson(): EngineConfig[] {
    if (this.enginesConfigCache !== null) {
      return this.enginesConfigCache;
    }

    try {
      // 尝试从多个可能的位置读取配置文件
      const possiblePaths = [
        path.join(process.cwd(), 'config', 'engines.json'),
        path.join(process.cwd(), 'apps', 'api', 'config', 'engines.json'),
        path.join(__dirname, '..', '..', 'config', 'engines.json'),
      ];

      let configPath: string | null = null;
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
      const config: EnginesConfigFile = JSON.parse(fileContent);

      // 处理占位符（${ENV_VAR} 格式）
      const processedEngines = config.engines.map((engine) => {
        if (engine.httpConfig) {
          // 处理 baseUrl 中的占位符
          if (engine.httpConfig.baseUrl && engine.httpConfig.baseUrl.startsWith('${') && engine.httpConfig.baseUrl.endsWith('}')) {
            const envVar = engine.httpConfig.baseUrl.slice(2, -1);
            engine.httpConfig.baseUrl = process.env[envVar] || engine.httpConfig.baseUrl;
          }
        }
        return engine;
      });

      this.enginesConfigCache = processedEngines;
      this.logger.log(`Loaded ${processedEngines.length} engine configs from ${configPath}`);
      return processedEngines;
    } catch (error) {
      this.logger.error(`Failed to load engines.json: ${error instanceof Error ? error.message : String(error)}`);
      this.enginesConfigCache = [];
      return [];
    }
  }

  /**
   * 根据 engineKey 查找配置
   */
  private findEngineConfigByKey(engineKey: string): EngineConfig | null {
    const configs = this.loadEngineConfigsFromJson();
    return configs.find((c) => c.engineKey === engineKey && c.enabled !== false) || null;
  }

  /**
   * 验证 HTTP 引擎配置
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 8.2 节（要求 3）
   */
  private validateHttpEngineConfig(
    baseUrl: string,
    timeoutMs: number,
    pathValue: string,
    authMode: HttpAuthMode,
    apiKey: string | undefined,
    hmac: HttpHmacConfig | undefined,
  ): void {
    // baseUrl 必须是有效的 URL 格式
    if (!baseUrl || baseUrl.trim() === '') {
      throw new Error('HTTP_ENGINE_BASE_URL is required but not set');
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid HTTP_ENGINE_BASE_URL format: ${baseUrl}`);
    }

    // timeoutMs 必须是正整数
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error(`HTTP_ENGINE_TIMEOUT_MS must be a positive integer, got: ${timeoutMs}`);
    }

    // path 必须以 / 开头
    if (pathValue && !pathValue.startsWith('/')) {
      throw new Error(`HTTP_ENGINE_PATH must start with '/', got: ${pathValue}`);
    }

    // 如果 authMode 是 bearer 或 apiKey，apiKey 必须存在且不为空
    if ((authMode === 'bearer' || authMode === 'apiKey') && (!apiKey || apiKey.trim() === '')) {
      throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is '${authMode}'`);
    }

    // 如果 authMode 是 hmac，hmac 配置必须存在
    if (authMode === 'hmac' && !hmac) {
      throw new Error(`HTTP_ENGINE_HMAC_SECRET is required when authMode is 'hmac'`);
    }

    // 生产环境不允许 authMode='none' 且 baseUrl 是 https
    if (
      env.isProduction &&
      authMode === 'none' &&
      baseUrl.startsWith('https://')
    ) {
      this.logger.warn(
        `Security warning: authMode='none' is not allowed in production for HTTPS endpoints. engineKey may be misconfigured.`,
      );
      // 不直接抛出错误，只记录警告，允许继续运行（但建议修复配置）
    }
  }

  /**
   * 清除配置缓存（用于测试或配置热加载）
   */
  clearCache(): void {
    this.enginesConfigCache = null;
  }
}

