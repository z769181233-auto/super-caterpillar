/**
 * apps/web/src/adapters/studio-preview.adapter.ts
 *
 * Studio Timeline Preview Adapter (HMAC v1.1)
 * 负责人：Antigravity
 * 对齐规约：APISpec V1.1, EngineSpec V1.1
 */

import { JobDTO } from '@/types/dto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface PreviewResponse {
  jobId: string;
  success: boolean;
}

/**
 * 计算 HMAC-SHA256 签名 (Web Crypto API)
 * 对齐 APISpec V1.1: X-Signature = HMAC_SHA256(api_key + nonce + timestamp + body)
 */
async function computeHMAC(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 发起 Timeline Preview 请求 (HMAC v1.1)
 */
export async function startTimelinePreview(
  apiKey: string,
  apiSecret: string,
  timelineData: any
): Promise<PreviewResponse> {
  const nonce = Math.random().toString(36).substring(2, 15);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(timelineData);

  // Canonical String v2: api_key + nonce + timestamp + rawBody
  const canonicalString = `${apiKey}${nonce}${timestamp}${body}`;
  const signature = await computeHMAC(apiSecret, canonicalString);

  const res = await fetch(`${API_BASE_URL}/api/timeline/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Nonce': nonce,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body,
  });

  const json = await res.json();

  if (!res.ok) {
    // 穿透返回 body.code (如 4004) 用于防重放测试与 UI 直显
    const error = new Error(json.message || 'Preview request failed') as any;
    error.code = json.code;
    error.status = res.status;
    throw error;
  }

  return {
    jobId: json.data?.jobId || json.data?.id,
    success: true,
  };
}

/**
 * 轮询作业状态 (指数退避)
 */
export async function pollJobStatus(
  jobId: string,
  maxAttempts = 30,
  initialDelay = 1000
): Promise<JobDTO> {
  let attempts = 0;
  let delay = initialDelay;

  while (attempts < maxAttempts) {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(`Failed to poll job status: ${res.status}`);
    }

    const job = json.data as JobDTO;

    if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
      return job;
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10000); // 指数退避，最高 10s
  }

  throw new Error('Job polling timed out');
}
