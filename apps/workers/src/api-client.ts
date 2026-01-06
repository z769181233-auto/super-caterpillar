/**
 * API Client for Worker
 * 封装与 API 服务器的通信
 * 支持 HMAC 认证
 */

import { createHmac, randomBytes, createHash } from 'crypto';
import { env } from '@scu/config';

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
  return createHash('sha256').update(body || '').digest('hex');
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
  console.error('[HMAC_TRACE] worker_v2_inputs', {
    method: { val: parts.method, len: parts.method.length, hash: sha256(parts.method) },
    path: { val: parts.path, len: parts.path.length, hash: sha256(parts.path) },
    timestamp: { val: parts.timestamp, len: parts.timestamp.length, hash: sha256(parts.timestamp) },
    nonce: { val: parts.nonce.substring(0, 8) + '...', len: parts.nonce.length, hash: sha256(parts.nonce) },
    bodyHash: { val: parts.bodyHash.substring(0, 16) + '...', len: parts.bodyHash.length, hash: sha256(parts.bodyHash) },
    workerId: parts.workerId ? { val: parts.workerId, len: parts.workerId.length, hash: sha256(parts.workerId) } : 'N/A',
    message: { len: parts.message.length, hash: sha256(parts.message) },
  });
  console.error('[HMAC_TRACE] worker_signature', {
    sigHash: sha256(parts.signature),
    sigLen: parts.signature.length,
  });
}

/**
 * 构建 HMAC 签名消息
 * v1: ${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}
 * v2: ${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}\n${workerId}
 */
function buildMessage(
  method: string,
  path: string,
  nonce: string,
  timestamp: string,
  body: string,
  workerId?: string,
): string {
  const contentHash = computeBodyHash(body);
  let message = `${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}`;
  if (workerId) {
    message += `\n${workerId}`;
  }
  return message;
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

  constructor(baseURL: string | undefined, apiKey?: string, apiSecret?: string) {
    if (!baseURL) {
      throw new Error(
        'ApiClient: baseURL 不能为空（请检查 env.apiUrl / API_HOST / API_PORT）'
      );
    }

    // 删除末尾斜杠，保证 URL 拼接正确
    this.baseURL = baseURL.replace(/\/$/, '');

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    console.log(`[Worker DEBUG] ApiClient request: ${method} ${path}`);
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 序列化请求体（商业级规范：空对象视为 empty string 以对齐 API Guard 逻辑）
    const hasBodyContent = body && typeof body === 'object' && Object.keys(body).length > 0;
    const bodyString = typeof body === 'string' ? body : (hasBodyContent ? JSON.stringify(body) : '');

    // 如果配置了 API Key 和 Secret，使用 HMAC 认证
    if (this.apiKey && this.apiSecret) {
      // 1. 准备签名参数
      const timestamp = Date.now().toString();
      const nonce = generateNonce();

      // 2. 检查是否使用v2签名（包含workerId）
      const workerId = extraHeaders?.['x-worker-id'];
      const useV2 = !!workerId;

      // 3. 构建签名消息（v2包含workerId）
      const message = buildMessage(method, path, nonce, timestamp, bodyString, workerId);

      // 4. 计算签名
      const signature = computeSignature(this.apiSecret, message);

      // HMAC_TRACE: 输出Worker端v2分段指纹
      if (useV2) {
        fingerprintParts({
          method,
          path,
          timestamp,
          nonce,
          bodyHash: computeBodyHash(bodyString),
          workerId,
          message,
          signature,
        });
      }

      // 5. 设置 HMAC 认证头
      headers['X-Api-Key'] = this.apiKey;
      headers['X-Nonce'] = nonce;
      headers['X-Timestamp'] = timestamp;
      headers['X-Signature'] = signature;
      if (useV2) {
        headers['X-Hmac-Version'] = '2';
      }

      // 调试日志（不打印密钥）
      console.log(
        `[Worker HMAC v${useV2 ? '2' : '1'}] ${method} ${path}`,
        `nonce=${nonce.substring(0, 8)}...`,
        `timestamp=${timestamp}`,
        `workerId=${workerId || 'N/A'}`,
        `bodyString=${bodyString}`,
      );
    } else {
      console.warn('[Worker] ⚠️  No API Key/Secret configured, requests may fail with 401');
      console.warn('[Worker] ⚠️  Please set WORKER_API_KEY and WORKER_API_SECRET environment variables.');
    }

    // 商业级审计：添加extraHeaders（v2时workerId已参与签名）
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error(
          '[Worker HTTP Error]',
          method,
          url,
          response.status,
          data?.message || data?.error?.message || `HTTP ${response.status}`,
        );
        // 打印请求头（不打印密钥）
        console.error('[Worker HTTP Error] Headers sent:', {
          'X-Api-Key': headers['X-Api-Key']?.substring(0, 10) + '...',
          'X-Nonce': headers['X-Nonce']?.substring(0, 8) + '...',
          'X-Timestamp': headers['X-Timestamp'],
          'X-Signature': headers['X-Signature']?.substring(0, 16) + '...',
        });
        throw new Error(data?.message || data?.error?.message || `HTTP ${response.status}`);
      }

      return data as ApiResponse<T>;
    } catch (error: any) {
      // 如果是网络错误，也打印 URL
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        console.error('[Worker HTTP Error]', method, url, 'Network Error', error.message);
      }
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async registerWorker(params: {
    workerId: string;
    name: string;
    capabilities: {
      supportedJobTypes?: string[];
      supportedModels?: string[];
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
    }>('POST', '/api/workers/register', params);

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
    console.log('DEBUG: heartbeat params (FIXED):', JSON.stringify(params));
    console.log('DEBUG: heartbeat body ACTUAL:', JSON.stringify(body));
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
  } | null> {
    const response = await this.request<{
      id: string;
      type: string;
      payload: any;
      taskId: string;
      shotId?: string;
      projectId?: string; // Add this
    } | null>('POST', `/api/workers/${workerId}/jobs/next`, {}, { 'x-worker-id': workerId });

    if (!response.success) {
      throw new Error('Failed to get next job');
    }

    // 增强日志：GET_NEXT_JOB_RES
    console.log(JSON.stringify({
      event: 'GET_NEXT_JOB_RES',
      status: (response as any).status || 200, // Assuming 200 if not present in successful response
      jobId: (response.data as any)?.id || null,
      timestamp: new Date().toISOString()
    }));

    return response.data || null;
  }

  async reportJobResult(params: {
    jobId: string;
    status: 'SUCCEEDED' | 'FAILED';
    result?: any;
    errorMessage?: string; // Correct parameter name
    error?: any; // internal input
    metrics?: { durationMs?: number; tokensUsed?: number; cost?: number;[key: string]: any };
    retryable?: boolean;
  }): Promise<any> {
    const requestBody: any = {
      status: params.status,
    };

    if (params.status === 'SUCCEEDED') {
      requestBody.result = params.result;
    } else {
      // API expects 'errorMessage' string
      const msg = params.errorMessage || (params.error?.message ?? (typeof params.error === 'string' ? params.error : JSON.stringify(params.error)));
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
    const response = await this.request<any>('POST', `/api/jobs/${params.jobId}/report`, requestBody);

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
    const response = await this.request<{ success: boolean }>(
      'POST',
      '/api/audit/logs',
      payload,
    );

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
    costAmount: number;
    currency?: string;
    billingUnit: string;
    quantity: number;
    metadata?: any;
  }): Promise<{ ok: boolean; id: string; deduplicated: boolean }> {
    const response = await this.request<{ ok: boolean; id: string; deduplicated: boolean }>(
      'POST',
      '/internal/events/cost-ledger',
      payload,
    );

    if (!response.success) {
      throw new Error('Failed to post cost event');
    }

    return response.data || { ok: true, id: 'unknown', deduplicated: false };
  }
}
