/**
 * HTTP Engine Adapter
 * HTTP 引擎适配器实现
 *
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3.6 节（HTTP 引擎适配器）
 * 参考《毛毛虫宇宙_TaskSystemAsyncExecutionSpec_V1.0》中 Engine 调用 / 错误处理相关部分
 * 参考 docs/ENGINE_HTTP_CONFIG.md (S3-A.1)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { EngineConfigService, HttpEngineConfig } from '../../config/engine.config';
import { HttpClient } from '../../common/http/http-client';
import { createHmac, createHash, randomBytes } from 'crypto';

/**
 * HTTP 引擎响应格式（预期）
 */
interface HttpEngineResponse {
  success?: boolean;
  status?: string;
  data?: any;
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    tokens?: number;
    cost?: number;
    costUsd?: number;
    [key: string]: any;
  };
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * HTTP Engine Adapter
 * 用于调用外部 HTTP 引擎服务
 */
@Injectable()
export class HttpEngineAdapter implements EngineAdapter {
  public readonly name = 'http';
  private readonly logger = new Logger(HttpEngineAdapter.name);

  constructor(private readonly engineConfigService: EngineConfigService) {}

  /**
   * 检查是否支持指定的引擎标识
   */
  supports(engineKey: string): boolean {
    return (
      engineKey === 'http' ||
      engineKey.startsWith('http_') ||
      engineKey === 'mock_http_engine' ||
      engineKey === 'ce06_novel_parsing' ||
      engineKey === 'ce03_visual_density' ||
      engineKey === 'ce04_visual_enrichment'
    );
  }

  /**
   * 调用 HTTP 引擎执行任务
   *
   * 注意：HttpEngineAdapter 内部绝对不要做重试或 sleep，重试交给已有 Job 重试机制（S2-A.2）
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.1 节
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();
    const { engineKey, jobType, payload, context } = input;

    try {
      // 1. 根据 engineKey 获取配置
      const config = this.engineConfigService.getHttpEngineConfig(engineKey);
      const url = `${config.baseUrl}${config.path || '/invoke'}`;

      // S3-A.3 阶段 2：统一构造请求体
      const requestBody = this.buildRequestBody(input);

      // 3. 构造认证 Header
      // 参考 docs/ENGINE_HTTP_CONFIG.md 第 6 节
      const headers = this.buildAuthHeaders(config, requestBody);

      // 4. 创建 HTTP 客户端并发送请求
      const httpClient = new HttpClient({
        baseURL: config.baseUrl,
        timeout: config.timeoutMs,
        headers,
      });

      // 5. 记录请求开始日志（脱敏处理）
      this.logRequestStart(engineKey, jobType, url, config, payload, context);

      const response = await httpClient.post<HttpEngineResponse>(
        config.path || '/invoke',
        requestBody
      );
      const durationMs = Date.now() - startTime;

      // 6. 处理响应
      // 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.2、7.3 节
      // 注意：这里只能在"成功路径"里挂接 parseResponseData/parseMetrics，错误分类逻辑不动
      return this.handleHttpResponse(
        { status: response.status, data: response.data, headers: response.headers as any },
        engineKey,
        jobType,
        durationMs
      );
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // 7. 处理异常
      // 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.2、7.3 节
      return this.handleHttpError(error, engineKey, jobType, durationMs);
    }
  }

  /**
   * S3-A.3 阶段 2：构造 HTTP 请求 Body
   * 将 EngineInvokeInput 转换为标准 HTTP 请求格式
   */
  private buildRequestBody(input: EngineInvokeInput): any {
    const baseBody = {
      jobType: input.jobType,
      engineKey: input.engineKey,
      payload: input.payload ?? {},
      context: input.context ?? {},
    };

    // 如有特殊 JobType，可以在这里做定制，否则先全部走基础结构
    switch (input.jobType) {
      case 'NOVEL_ANALYSIS_HTTP':
        // 目前不做裁剪，后面如需适配具体外部 API 再细化
        return baseBody;
      case 'SHOT_RENDER_HTTP':
        return baseBody;
      default:
        return baseBody;
    }
  }

  /**
   * 构造认证 Header
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 6.3 节
   */
  private buildAuthHeaders(config: HttpEngineConfig, requestBody: any): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (config.authMode) {
      case 'bearer':
        if (!config.apiKey || config.apiKey.trim() === '') {
          throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is 'bearer'`);
        }
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;

      case 'apiKey':
        if (!config.apiKey || config.apiKey.trim() === '') {
          throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is 'apiKey'`);
        }
        headers[config.apiKeyHeader || 'X-API-Key'] = config.apiKey;
        break;

      case 'hmac':
        {
          if (!config.hmac) {
            throw new Error(`HTTP_ENGINE_HMAC_SECRET is required when authMode is 'hmac'`);
          }
          const hmacHeaders = this.buildHmacHeaders(config.hmac, requestBody);
          Object.assign(headers, hmacHeaders);
        }
        break;

      case 'none':
        // 不添加任何认证头
        break;

      default:
        throw new Error(`Unsupported authMode: ${config.authMode}`);
    }

    return headers;
  }

  /**
   * 构造 HMAC 认证 Header
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 6.1 节（方式 3）
   * 复用项目现有的 HMAC 签名机制
   */
  private buildHmacHeaders(
    hmacConfig: { keyId: string; secret: string; algorithm: 'sha256'; header?: string },
    requestBody: any
  ): Record<string, string> {
    const timestamp = Date.now().toString();
    const nonce = randomBytes(16).toString('hex');
    const bodyString = JSON.stringify(requestBody);
    const bodyHash = this.computeBodyHash(bodyString);

    // 构建签名消息：参考 HmacAuthService.buildMessage 的格式
    // 格式：POST\n/invoke\n${bodyHash}\n${nonce}\n${timestamp}
    const message = `POST\n${'/invoke'}\n${bodyHash}\n${nonce}\n${timestamp}`;
    const signature = this.computeHmacSignature(hmacConfig.secret, message);

    return {
      [hmacConfig.header || 'X-Signature']: signature,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-API-Key': hmacConfig.keyId,
    };
  }

  /**
   * 计算请求体的 SHA256 哈希
   * 参考 HmacAuthService.computeBodyHash
   */
  private computeBodyHash(body: string): string {
    return createHash('sha256').update(body, 'utf8').digest('hex');
  }

  /**
   * 计算 HMAC-SHA256 签名
   * 参考 HmacAuthService.computeSignature
   */
  private computeHmacSignature(secret: string, message: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * 记录请求开始日志（脱敏处理）
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 8.2 节（要求 4）
   */
  private logRequestStart(
    engineKey: string,
    jobType: string,
    url: string,
    config: HttpEngineConfig,
    payload: any,
    context: any
  ): void {
    const logData: any = {
      event: 'HTTP_ENGINE_INVOKE_START',
      engineKey,
      jobType,
      url,
      payloadSize: JSON.stringify(payload).length,
      contextKeys: Object.keys(context),
      authMode: config.authMode,
    };

    // 脱敏处理：只显示 API Key 的前 4 位和后 4 位
    if (config.apiKey) {
      const apiKey = config.apiKey;
      if (apiKey.length >= 8) {
        logData.hasApiKey = true;
        logData.apiKeyPrefix = apiKey.substring(0, 4);
        logData.apiKeySuffix = apiKey.substring(apiKey.length - 4);
        logData.apiKeyLength = apiKey.length;
      } else {
        logData.hasApiKey = true;
        logData.apiKeyLength = apiKey.length;
      }
    } else {
      logData.hasApiKey = false;
    }

    this.logger.log(JSON.stringify(logData));
  }

  /**
   * 处理 HTTP 响应
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.2、7.3 节
   */
  private handleHttpResponse(
    response: { status: number; data: HttpEngineResponse; headers: Record<string, string> },
    engineKey: string,
    jobType: string,
    durationMs: number
  ): EngineInvokeResult {
    const responseData = response.data;

    // 规则 1-5：根据 HTTP 状态码和业务层标志分类
    if (response.status >= 200 && response.status < 300) {
      // 规则 5：检查业务层成功标志
      if (responseData.success === true || responseData.status === 'SUCCESS') {
        // S3-A.3 阶段 2：在 SUCCESS 分支中解析响应数据和 metrics
        const output = this.parseResponseData(responseData, jobType);
        const metrics = this.parseMetrics(responseData.metrics, durationMs);

        this.logger.log(
          JSON.stringify({
            event: 'HTTP_ENGINE_INVOKE_SUCCESS',
            engineKey,
            jobType,
            status: 'SUCCESS',
            durationMs,
            httpStatusCode: response.status,
            outputSize: output ? JSON.stringify(output).length : 0,
          })
        );

        return {
          status: 'SUCCESS' as any,
          output,
          metrics,
        };
      }

      // 规则 5：业务层错误 → FAILED
      const errorCode = responseData.error?.code || 'BUSINESS_ERROR';
      const errorMessage = responseData.error?.message || 'Business logic failed';

      this.logger.warn(
        JSON.stringify({
          event: 'HTTP_ENGINE_INVOKE_BUSINESS_ERROR',
          engineKey,
          jobType,
          status: 'FAILED',
          durationMs,
          httpStatusCode: response.status,
          errorCode,
          errorMessage,
        })
      );

      return {
        status: 'FAILED' as any,
        error: {
          message: errorMessage,
          code: errorCode,
          details: {
            ...responseData.error?.details,
            errorType: 'BUSINESS_ERROR',
          },
        },
        metrics: {
          durationMs,
        },
      };
    }

    // 规则 4：HTTP 429（限流）→ RETRYABLE
    if (response.status === 429) {
      const retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
      this.logger.warn(
        JSON.stringify({
          event: 'HTTP_ENGINE_INVOKE_RATE_LIMIT',
          engineKey,
          jobType,
          status: 'RETRYABLE',
          httpStatusCode: 429,
          retryAfter: retryAfter || undefined,
          durationMs,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        status: 'RETRYABLE' as any,
        error: {
          message: `HTTP 429 Too Many Requests${retryAfter ? `, Retry-After: ${retryAfter}` : ''}`,
          code: 'HTTP_RATE_LIMIT',
          details: { retryAfter, errorType: 'HTTP_429' },
        },
        metrics: {
          durationMs,
        },
      };
    }

    // 规则 2：HTTP 5xx → RETRYABLE
    if (response.status >= 500) {
      this.logger.warn(
        JSON.stringify({
          event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
          engineKey,
          jobType,
          status: 'RETRYABLE',
          durationMs,
          httpStatusCode: response.status,
          errorCode: 'HTTP_SERVER_ERROR',
        })
      );

      return {
        status: 'RETRYABLE' as any,
        error: {
          message: `HTTP ${response.status} Server Error`,
          code: 'HTTP_SERVER_ERROR',
          details: { errorType: 'HTTP_5XX' },
        },
        metrics: {
          durationMs,
        },
      };
    }

    // 规则 3：HTTP 4xx（除 429）→ FAILED
    this.logger.error(
      JSON.stringify({
        event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
        engineKey,
        jobType,
        status: 'FAILED',
        durationMs,
        httpStatusCode: response.status,
        errorCode: 'HTTP_CLIENT_ERROR',
      })
    );

    return {
      status: 'FAILED' as any,
      error: {
        message: `HTTP ${response.status} Client Error`,
        code: 'HTTP_CLIENT_ERROR',
        details: { errorType: 'HTTP_4XX' },
      },
      metrics: {
        durationMs,
      },
    };
  }

  /**
   * S3-A.3 阶段 2：解析响应数据
   * 根据 JobType 解析不同的响应格式，不修改错误分类逻辑
   */
  private parseResponseData(
    responseData: HttpEngineResponse,
    jobType: string
  ): Record<string, any> {
    if (!responseData) return {};

    const data = (responseData as any).data ?? {};

    switch (jobType) {
      case 'NOVEL_ANALYSIS_HTTP':
        // 这里先直接透传 data，将来根据外部 HTTP 引擎真实返回结构再细化
        return data;
      case 'SHOT_RENDER_HTTP':
        return data;
      default:
        return data;
    }
  }

  /**
   * S3-A.3 阶段 2：解析 metrics
   * 将外部服务的 metrics 字段映射到 EngineInvokeResult.metrics 格式
   */
  private parseMetrics(
    rawMetrics?: any,
    durationMs?: number
  ): EngineInvokeResult['metrics'] | undefined {
    if (!rawMetrics && durationMs === undefined) return undefined;

    return {
      durationMs: durationMs ?? rawMetrics?.durationMs,
      tokensUsed: rawMetrics?.tokensUsed ?? rawMetrics?.tokens,
      cost: rawMetrics?.cost ?? rawMetrics?.costUsd,
      // 保留原始 metrics 字段，方便将来扩展
      ...rawMetrics,
    };
  }

  /**
   * 处理 HTTP 错误
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.2、7.3 节
   */
  private handleHttpError(
    error: any,
    engineKey: string,
    jobType: string,
    durationMs: number
  ): EngineInvokeResult {
    // 规则 1：网络错误 → RETRYABLE
    if (error.type === 'NETWORK_ERROR') {
      const errorCode = this.mapNetworkErrorCode(error.code);

      this.logger.warn(
        JSON.stringify({
          event: 'HTTP_ENGINE_INVOKE_NETWORK_ERROR',
          engineKey,
          jobType,
          status: 'RETRYABLE',
          durationMs,
          errorCode,
          errorMessage: error.message,
        })
      );

      return {
        status: 'RETRYABLE' as any,
        error: {
          message: error.message || 'Network or timeout error',
          code: errorCode,
          details: { errorType: 'NETWORK_ERROR' },
        },
        metrics: {
          durationMs,
        },
      };
    }

    // HTTP 错误（4xx, 5xx）
    if (error.type === 'HTTP_ERROR') {
      // 规则 4：HTTP 429 → RETRYABLE
      if (error.status === 429) {
        this.logger.warn(
          JSON.stringify({
            event: 'HTTP_ENGINE_INVOKE_RATE_LIMIT',
            engineKey,
            jobType,
            status: 'RETRYABLE',
            httpStatusCode: 429,
            durationMs,
            timestamp: new Date().toISOString(),
          })
        );

        return {
          status: 'RETRYABLE' as any,
          error: {
            message: `HTTP 429 Too Many Requests`,
            code: 'HTTP_RATE_LIMIT',
            details: { errorType: 'HTTP_429' },
          },
          metrics: {
            durationMs,
          },
        };
      }

      // 规则 2：HTTP 5xx → RETRYABLE
      if (error.status >= 500) {
        this.logger.warn(
          JSON.stringify({
            event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
            engineKey,
            jobType,
            status: 'RETRYABLE',
            durationMs,
            httpStatusCode: error.status,
            errorCode: 'HTTP_SERVER_ERROR',
          })
        );

        return {
          status: 'RETRYABLE' as any,
          error: {
            message: error.message || `HTTP ${error.status} Server Error`,
            code: 'HTTP_SERVER_ERROR',
            details: { errorType: 'HTTP_5XX' },
          },
          metrics: {
            durationMs,
          },
        };
      }

      // 规则 3：HTTP 4xx（除 429）→ FAILED
      this.logger.error(
        JSON.stringify({
          event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
          engineKey,
          jobType,
          status: 'FAILED',
          durationMs,
          httpStatusCode: error.status,
          errorCode: 'HTTP_CLIENT_ERROR',
        })
      );

      return {
        status: 'FAILED' as any,
        error: {
          message: error.message || `HTTP ${error.status} Client Error`,
          code: 'HTTP_CLIENT_ERROR',
          details: { errorType: 'HTTP_4XX' },
        },
        metrics: {
          durationMs,
        },
      };
    }

    // 其他错误 → FAILED
    this.logger.error(
      JSON.stringify({
        event: 'HTTP_ENGINE_INVOKE_FAILED',
        engineKey,
        jobType,
        status: 'FAILED',
        durationMs,
        errorCode: 'UNKNOWN_ERROR',
        errorMessage: error.message || 'Unknown error',
      })
    );

    return {
      status: 'FAILED' as any,
      error: {
        message: error.message || 'HTTP request failed',
        code: 'UNKNOWN_ERROR',
        details: { errorType: 'UNKNOWN_ERROR' },
      },
      metrics: {
        durationMs,
      },
    };
  }

  /**
   * 映射网络错误码
   * 参考 docs/ENGINE_HTTP_CONFIG.md 第 7.2 节（规则 1）
   * @param code 原始错误码
   * @returns 标准错误码
   */
  private mapNetworkErrorCode(code: string): string {
    // 网络/超时类错误 → HTTP_TEMPORARY_ERROR
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENETUNREACH',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EAI_AGAIN',
    ];

    if (retryableCodes.includes(code)) {
      return 'HTTP_TEMPORARY_ERROR';
    }

    return 'HTTP_TEMPORARY_ERROR'; // 默认也认为是可重试的临时错误
  }
}
