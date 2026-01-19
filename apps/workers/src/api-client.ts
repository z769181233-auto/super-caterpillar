/**
 * API Client for Worker
 * 封装与 API 服务器的通信
 * 支持 HMAC 认证
 */

import { createHmac, randomBytes, createHash } from 'crypto';
import { env } from '@scu/config';
import * as util from 'util';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

/**
 * 生成随机 nonce
 */
let nonceCounter = 0;
function generateNonce(): string {
  return `${randomBytes(16).toString('hex')}-${nonceCounter++}-${Date.now()}`;
}

/**
 * 计算 Body Hash
 */
function computeBodyHash(body: string): string {
  return createHash('sha256')
    .update(body || '')
    .digest('hex');
}

/**
 * HMAC_TRACE 调试：分段指纹
 */
function fingerprintParts(parts: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
  workerId?: string;
  message: string;
  signature: string;
}) {
  if (process.env.HMAC_TRACE !== '1') return;
  const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
  process.stderr.write(
    util.format('[HMAC_TRACE] worker_v2_inputs', {
      method: { val: parts.method, len: parts.method.length, hash: sha256(parts.method) },
      path: { val: parts.path, len: parts.path.length, hash: sha256(parts.path) },
      timestamp: {
        val: parts.timestamp,
        len: parts.timestamp.length,
        hash: sha256(parts.timestamp),
      },
      nonce: {
        val: parts.nonce.substring(0, 8) + '...',
        len: parts.nonce.length,
        hash: sha256(parts.nonce),
      },
      bodyHash: {
        val: parts.bodyHash.substring(0, 16) + '...',
        len: parts.bodyHash.length,
        hash: sha256(parts.bodyHash),
      },
      workerId: parts.workerId
        ? { val: parts.workerId, len: parts.workerId.length, hash: sha256(parts.workerId) }
        : 'N/A',
      message: { len: parts.message.length, hash: sha256(parts.message) },
    }) + '\n'
  );
  process.stderr.write(
    util.format('[HMAC_TRACE] worker_signature', {
      sigHash: sha256(parts.signature),
      sigLen: parts.signature.length,
    }) + '\n'
  );
}

/**
 * 构建 HMAC 签名消息
 * v1: ${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}
 * v2: ${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}\n${workerId}
 */
function buildMessage(apiKey: string, nonce: string, timestamp: string, body: string): string {
  // Spec V1.1 Strict: apiKey + nonce + timestamp + body
  return apiKey + nonce + timestamp + body;
}

/**
 * 计算 HMAC-SHA256 签名
 * 与后端 HmacAuthService.computeSignature 逻辑一致
 */
function computeSignature(secret: string, message: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

export class ApiClient {
  private baseURL: string;
  private apiKey?: string;
  private apiSecret?: string;
  private workerId?: string;

  constructor(baseURL: string | undefined, apiKey?: string, apiSecret?: string, workerId?: string) {
    if (!baseURL) {
      throw new Error('ApiClient: baseURL 不能为空（请检查 env.apiUrl / API_HOST / API_PORT）');
    }

    // 删除末尾斜杠，保证 URL 拼接正确
    this.baseURL = baseURL.replace(/\/$/, '');

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.workerId = workerId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    extraHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    process.stdout.write(util.format(`[Worker DEBUG] ApiClient request: ${method} ${path}`) + '\n');
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 序列化请求体（商业级规范：空对象视为 empty string 以对齐 API Guard 逻辑）
    const hasBodyContent = body && typeof body === 'object' && Object.keys(body).length > 0;
    const bodyString = typeof body === 'string' ? body : hasBodyContent ? JSON.stringify(body) : '';

    // 如果配置了 API Key 和 Secret，使用 HMAC 认证
    if (this.apiKey && this.apiSecret) {
      // 1. 准备签名参数
      // APISpec V1.1: X-Timestamp MUST BE IN SECONDS
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = generateNonce();

      // 2. 强制要求x-worker-id（商业级：避免回退到v1签名）
      // 优先使用实例workerId，其次使用extraHeaders中的
      const workerId = this.workerId ?? extraHeaders?.['x-worker-id'];
      if (!workerId) {
        throw new Error('[AUTH] missing x-worker-id header; refusing to sign without workerId');
      }

      const message = buildMessage(this.apiKey, nonce, timestamp, bodyString);
      const signature = createHmac('sha256', this.apiSecret).update(message).digest('hex');
      const bodyHash = createHash('sha256').update(bodyString).digest('hex');

      // 4. 设置 HMAC 认证头
      headers['X-Timestamp'] = timestamp;
      headers['X-Nonce'] = nonce;
      headers['X-Signature'] = signature;
      headers['X-Api-Key'] = this.apiKey;
      headers['X-Content-SHA256'] = bodyHash;
      headers['X-Hmac-Version'] = '1.1';

      // 调试日志（不打印密钥）
      process.stdout.write(
        util.format(
          `[Worker HMAC v2] ${method} ${path}`,
          `nonce=${nonce.substring(0, 8)}...`,
          `timestamp=${timestamp}`,
          `workerId=${workerId}`,
          `bodyString=${bodyString}`
        ) + '\n'
      );
    } else {
      process.stdout.write(
        util.format('[Worker] ⚠️  No API Key/Secret configured, requests may fail with 401') + '\n'
      );
      process.stdout.write(
        util.format(
          '[Worker] ⚠️  Please set WORKER_API_KEY and WORKER_API_SECRET environment variables.'
        ) + '\n'
      );
    }

    // 商业级审计：添加extraHeaders（v2时workerId已参与签名）
    // 确保x-worker-id始终存在于headers中
    const mergedHeaders = {
      ...extraHeaders,
      'x-worker-id': this.workerId ?? extraHeaders?.['x-worker-id'],
    };
    Object.assign(headers, mergedHeaders);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
      });

      // For non-2xx responses, parse the error body and log it.
      if (!response.ok) {
        const errorBody = await response.text();
        process.stderr.write(
          util.format(
            `[ApiClient] request failed: ${method} ${path} -> HTTP ${response.status}\nBody: ${errorBody}`
          ) + '\n'
        );
        let data: any;
        try {
          data = JSON.parse(errorBody);
        } catch (e) {
          // ignore, body might not be JSON
        }

        // Log headers sent for debugging
        process.stderr.write(
          util.format('[Worker HTTP Error] Headers sent:', {
            'X-Api-Key': headers['X-Api-Key']?.substring(0, 10) + '...',
            'X-Nonce': headers['X-Nonce']?.substring(0, 8) + '...',
            'X-Timestamp': headers['X-Timestamp'],
            'X-Signature': headers['X-Signature']?.substring(0, 16) + '...',
          }) + '\n'
        );
        throw new Error(data?.message || data?.error?.message || `HTTP ${response.status}`);
      }

      const successText = await response.text();
      let successData: any;
      try {
        successData = JSON.parse(successText);
      } catch (e) {
        successData = { success: true, data: successText };
      }
      return successData as ApiResponse<T>;
    } catch (error: any) {
      // 如果是网络错误，也打印 URL
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        process.stderr.write(
          util.format('[Worker HTTP Error]', method, url, 'Network Error', error.message) + '\n'
        );
      }
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async registerWorker(params: {
    workerId: string;
    name: string;
    capabilities?: {
      supportedJobTypes?: string[];
      supportedModels?: string[];
      supportedEngines?: string[]; // ✅ P1-2 HA: 添加引擎支持
      maxBatchSize?: number;
    };
    gpuCount?: number;
    gpuMemory?: number;
    gpuType?: string;
  }): Promise<{ id: string; workerId: string; status: string; capabilities: any }> {
    const response = await this.request<{
      id: string;
      workerId: string;
      status: string;
      capabilities: any;
    }>('POST', '/api/workers/register', params, {
      'x-worker-id': params.workerId,
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to register worker');
    }

    return response.data;
  }

  async heartbeat(params: {
    workerId: string;
    status?: string | any; // WorkerStatus enum
    tasksRunning?: number;
    temperature?: number;
  }): Promise<{ workerId: string; status: string; lastHeartbeat: string }> {
    const { workerId, ...body } = params;
    process.stdout.write(
      util.format('DEBUG: heartbeat params (FIXED):', JSON.stringify(params)) + '\n'
    );
    process.stdout.write(util.format('DEBUG: heartbeat body ACTUAL:', JSON.stringify(body)) + '\n');
    const response = await this.request<{
      workerId: string;
      status: string;
      lastHeartbeat: string;
    }>('POST', `/api/workers/${workerId}/heartbeat`, body);

    if (!response.success && !(response as any).ok) {
      throw new Error('Failed to send heartbeat');
    }

    return (response.data || response) as any;
  }

  async getNextJob(workerId: string): Promise<{
    id: string;
    type: string;
    payload: any;
    taskId: string;
    shotId?: string;
    projectId?: string;
    episodeId?: string;
    sceneId?: string;
    organizationId?: string;
    createdAt: string; // P1-4: For queue time metric
  } | null> {
    const response = await this.request<{
      id: string;
      type: string;
      payload: any;
      taskId: string;
      shotId?: string;
      projectId?: string;
      episodeId?: string;
      sceneId?: string;
      organizationId?: string;
      createdAt: string; // P1-4
    } | null>('POST', `/api/workers/${workerId}/jobs/next`, {}, { 'x-worker-id': workerId });

    if (!response.success) {
      throw new Error('Failed to get next job');
    }

    // 增强日志：GET_NEXT_JOB_RES
    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'GET_NEXT_JOB_RES',
          status: (response as any).status || 200, // Assuming 200 if not present in successful response
          jobId: (response.data as any)?.id || null,
          timestamp: new Date().toISOString(),
        })
      ) + '\n'
    );

    return response.data || null;
  }

  async ackJob(jobId: string, workerId: string): Promise<any> {
    const response = await this.request<any>(
      'POST',
      `/api/jobs/${jobId}/ack`,
      { workerId },
      { 'x-worker-id': workerId }
    );

    if (!response.success && !(response as any).data) {
      // Accommodate generic success wrappers
      // If it's 200/201 but success flag is varied, it's fine.
      // But allow void/success returns.
    }
    return response.data || {};
  }

  async reportJobResult(params: {
    jobId: string;
    status: 'SUCCEEDED' | 'FAILED';
    result?: any;
    errorMessage?: string; // Correct parameter name
    error?: any; // internal input
    metrics?: { durationMs?: number; tokensUsed?: number; cost?: number; [key: string]: any };
    retryable?: boolean;
  }): Promise<any> {
    const requestBody: any = {
      status: params.status,
    };

    if (params.status === 'SUCCEEDED') {
      requestBody.result = params.result;
    } else {
      // API expects 'errorMessage' string
      const msg =
        params.errorMessage ||
        (params.error?.message ??
          (typeof params.error === 'string' ? params.error : JSON.stringify(params.error)));
      if (msg) requestBody.errorMessage = msg;
    }

    if (params.metrics) {
      requestBody.metrics = params.metrics;
    }
    if (params.retryable !== undefined) {
      requestBody.retryable = params.retryable;
    }

    // The `request` method handles HMAC signature using global generateNonce and computeSignature.
    // We just pass the body.
    const response = await this.request<any>(
      'POST',
      `/api/jobs/${params.jobId}/report`,
      requestBody
    );

    return response.data;
  }

  /**
   * 上报审计日志（Stage13）
   * POST /api/audit/logs
   */
  async postAuditLog(payload: {
    traceId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey: string;
    status: 'SUCCESS' | 'FAILED';
    inputHash?: string;
    outputHash?: string;
    latencyMs?: number;
    cost?: number;
    auditTrail?: any;
    errorMessage?: string;
    resourceId?: string;
    resourceType?: string;
  }): Promise<{ success: boolean }> {
    const response = await this.request<{ success: boolean }>('POST', '/api/audit/logs', payload);

    if (!response.success) {
      throw new Error('Failed to post audit log');
    }

    return response.data || { success: true };
  }

  /**
   * P0-2: 发送成本事件到 Internal Events API
   * POST /internal/events/cost-ledger
   * ✅ 自动带 HMAC 签名
   * ⚠️ 不阻断主流程（调用方应 try/catch + 日志降级）
   */
  async postCostEvent(payload: {
    userId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey?: string;
    attempt?: number; // ✅ P1-1: 试次支持
    costAmount: number;
    currency?: string;
    billingUnit: string;
    quantity: number;
    metadata?: any;
  }): Promise<{ ok: boolean; id: string; deduplicated: boolean }> {
    const response = await this.request<{ ok: boolean; id: string; deduplicated: boolean }>(
      'POST',
      '/api/internal/events/cost-ledger',
      payload
    );

    if (!response.success) {
      throw new Error('Failed to post cost event');
    }

    return response.data || { ok: true, id: 'unknown', deduplicated: false };
  }

  /**
   * 创建新 Job (通过 API 以确保计费和引擎绑定生效)
   * 支持两种模式：
   * 1. 基于 ShotID (Legacy): createJob(shotId, dto)
   * 2. 通用架构 (Project-based): createJob({ jobType, projectId, organizationId, payload, ... })
   */
  async createJob(
    shotIdOrDto:
      | string
      | {
          jobType: string;
          projectId: string;
          organizationId: string;
          payload?: any;
          parentJobId?: string;
          traceId?: string;
        },
    dto?: { type?: string; jobType?: string; payload?: any; traceId?: string },
    headers?: Record<string, string>
  ): Promise<any> {
    let url = '/api/jobs'; // 默认通用路径
    let body: any = {};

    if (typeof shotIdOrDto === 'string') {
      // Legacy Shot-based creation
      url = `/api/shots/${shotIdOrDto}/jobs`;
      body = dto || {};
    } else {
      // New Project-based distributed creation
      body = shotIdOrDto;
      // 适配 API 期望的字段名 (type vs jobType)
      if (body.jobType && !body.type) body.type = body.jobType;
    }

    const response = await this.request<any>('POST', url, body, headers);

    if (!response.success && !(response as any).data) {
      throw new Error(`Failed to create job: ${response.error?.message || response.message}`);
    }

    return response.data;
  }
}
