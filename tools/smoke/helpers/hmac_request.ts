/**
 * HMAC Request Helper
 * 生产等价的 HMAC 调用验证
 *
 * 要求：
 * - Header: X-Api-Key / X-Nonce / X-Timestamp / X-Signature
 * - 时间戳窗口：±5 分钟
 * - Nonce 5 分钟内不可重复
 * - HMAC-SHA256 严格验证
 */

import * as crypto from 'crypto';
import { readResponseBody } from './response_body';

export interface HmacRequestOptions {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  nonce?: string;
  timestamp?: number;
}

export interface HmacRequestResult {
  success: boolean;
  status: number;
  response: any;
  requestHeaders: Record<string, string>;
  timestamp: string;
  error?: string;
}

function generateSignature(
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  body: string,
  secret: string,
  apiKey: string
): string {
  const contentHash = crypto
    .createHash('sha256')
    .update(body || '')
    .digest('hex');
  // Unified with ApiSecurityService v2 spec
  const stringToSign = `v2\n${method}\n${path}\n${apiKey}\n${timestamp}\n${nonce}\n${contentHash}\n`;
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

export async function makeHmacRequest(options: HmacRequestOptions): Promise<HmacRequestResult> {
  const {
    apiBaseUrl,
    apiKey,
    apiSecret,
    method,
    path,
    body,
    nonce: providedNonce,
    timestamp: providedTimestamp,
  } = options;

  const timestamp = providedTimestamp || Math.floor(Date.now() / 1000);
  const nonce = providedNonce || `nonce-${timestamp}-${Math.random().toString(36).substring(7)}`;
  const bodyString = body ? JSON.stringify(body) : '';

  const signature = generateSignature(
    method,
    path,
    timestamp,
    nonce,
    bodyString,
    apiSecret,
    apiKey
  );

  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
    'Content-Type': 'application/json',
  };

  if (bodyString) {
    headers['X-Content-SHA256'] = crypto.createHash('sha256').update(bodyString).digest('hex');
  }

  try {
    const url = `${apiBaseUrl}${path}`;
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(10000),
    };

    if (bodyString && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = bodyString;
    }

    const response = await fetch(url, fetchOptions);
    const responseData = await readResponseBody(response);

    return {
      success: response.ok,
      status: response.status,
      response: responseData,
      requestHeaders: headers,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: false,
      status: 0,
      response: { error: error?.message ?? String(error) },
      requestHeaders: headers,
      timestamp: new Date().toISOString(),
      error: error?.message ?? String(error),
    };
  }
}

export async function testNonceReplay(
  options: Omit<HmacRequestOptions, 'nonce' | 'timestamp'>
): Promise<{ firstRequest: HmacRequestResult; secondRequest: HmacRequestResult }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = `replay-test-${timestamp}-${Math.random().toString(36).substring(7)}`;

  const firstRequest = await makeHmacRequest({
    ...options,
    nonce,
    timestamp,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const secondRequest = await makeHmacRequest({
    ...options,
    nonce,
    timestamp: timestamp + 1,
  });

  return { firstRequest, secondRequest };
}
