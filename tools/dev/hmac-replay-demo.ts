#!/usr/bin/env node
/**
 * Stage5: HMAC 签名重放演练工具
 *
 * 用途：本地开发工具，用于验证 HMAC 签名和 Nonce 重放防护
 * 注意：仅用于开发/测试环境，不进入生产代码
 *
 * 使用方法：
 *   pnpm tsx tools/dev/hmac-replay-demo.ts \
 *     --api-key <API_KEY> \
 *     --secret <SECRET> \
 *     --base-url http://localhost:3000 \
 *     --path /api/workers/test-worker-001/jobs/next \
 *     --method POST
 */

import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

interface Options {
  apiKey: string;
  secret: string;
  baseUrl?: string;
  path?: string;
  method?: string;
  body?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    apiKey: '',
    secret: '',
    baseUrl: 'http://localhost:3000',
    path: '/api/workers/test-worker-001/jobs/next',
    method: 'POST',
    body: '{}',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--secret':
        options.secret = args[++i];
        break;
      case '--base-url':
        options.baseUrl = args[++i];
        break;
      case '--path':
        options.path = args[++i];
        break;
      case '--method':
        options.method = args[++i];
        break;
      case '--body':
        options.body = args[++i];
        break;
    }
  }

  if (!options.apiKey || !options.secret) {
    console.error('错误: 必须提供 --api-key 和 --secret');
    process.exit(1);
  }

  return options;
}

/**
 * 计算 HMAC-SHA256 签名
 *
 * Payload 格式（与 hmac-signature.interceptor.ts 对齐）：
 * ${method}\n${path}\n${timestamp}\n${nonce}\n${body}
 */
/**
 * 计算 HMAC-SHA256 签名
 *
 * Payload 格式（与 hmac-signature.interceptor.ts:110 对齐）：
 * ${method}\n${requestPath}\n${timestamp}\n${nonce}\n${body}
 *
 * 注意：
 * - interceptor:107 使用 `request.originalUrl || request.url`（包含完整路径，可能包含 query string）
 * - 但实际测试中，我们传入的 path 通常不包含 query string
 * - 为了与 interceptor 完全一致，我们使用传入的 path 作为 requestPath（不主动处理 query string）
 */
function computeSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  // 使用传入的 path 作为 requestPath（与 interceptor:107 的 requestPath 逻辑一致）
  // 注意：如果 path 包含 query string，需要保留（与 interceptor 行为一致）
  const requestPath = path;
  const payload = `${method}\n${requestPath}\n${timestamp}\n${nonce}\n${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * 发送 HTTP 请求
 */
function sendRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ statusCode: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  const { apiKey, secret, baseUrl, path, method, body } = options;

  console.log('=== Stage5: HMAC 签名重放演练工具 ===\n');
  console.log('配置:');
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);
  console.log(`  Secret: ${secret.substring(0, 8)}...`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Path: ${path}`);
  console.log(`  Method: ${method}`);
  console.log(`  Body: ${body}\n`);

  // 生成时间戳和 nonce
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `demo-nonce-${Date.now()}`;

  // 计算签名
  const signature = computeSignature(secret, method, path, timestamp, nonce, body);

  console.log('签名参数:');
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Nonce: ${nonce}`);
  console.log(`  Signature: ${signature.substring(0, 16)}...\n`);

  // 第一次请求（合法）
  console.log('--- 第一次请求（合法）---');
  const headers1 = {
    'X-Api-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
    'Content-Type': 'application/json',
  };

  try {
    const response1 = await sendRequest(`${baseUrl}${path}`, method, headers1, body);
    console.log(`状态码: ${response1.statusCode}`);
    console.log('响应体:');
    try {
      const jsonBody = JSON.parse(response1.body);
      console.log(JSON.stringify(jsonBody, null, 2));
    } catch {
      console.log(response1.body);
    }

    // 验证：第一次请求不应是签名错误（4003）或重放错误（4004）
    const body1 = JSON.parse(response1.body);
    if (body1.error?.code === '4003' || body1.error?.code === '4004') {
      console.error('\n❌ 错误: 第一次请求不应返回签名错误或重放错误');
      console.error('   可能原因: 签名计算错误、API Key 无效、或路径不匹配');
      process.exit(1);
    }
    console.log('✅ 第一次请求成功（非签名/重放错误）\n');
  } catch (error: any) {
    console.error('请求失败:', error.message);
    process.exit(1);
  }

  // 第二次请求（使用相同 nonce，期望 4004）
  console.log('--- 第二次请求（使用相同 nonce，期望 4004）---');
  const headers2 = {
    'X-Api-Key': apiKey,
    'X-Timestamp': timestamp, // 使用相同时间戳
    'X-Nonce': nonce, // 使用相同 nonce（重放）
    'X-Signature': signature, // 使用相同签名
    'Content-Type': 'application/json',
  };

  try {
    const response2 = await sendRequest(`${baseUrl}${path}`, method, headers2, body);
    console.log(`状态码: ${response2.statusCode}`);
    console.log('响应体:');
    try {
      const jsonBody = JSON.parse(response2.body);
      console.log(JSON.stringify(jsonBody, null, 2));

      // 验证：第二次请求必须是 4004（Nonce replay）
      if (jsonBody.error?.code === '4004') {
        console.log('\n✅ 第二次请求正确返回 4004（Nonce replay detected）');
        console.log('✅ Stage5 验证通过：Nonce 重放防护生效');
      } else {
        console.error(
          '\n❌ 错误: 第二次请求应返回 4004（Nonce replay），但实际返回:',
          jsonBody.error?.code
        );
        process.exit(1);
      }
    } catch {
      console.log(response2.body);
      console.error('\n❌ 错误: 无法解析响应体');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('请求失败:', error.message);
    process.exit(1);
  }

  console.log('\n=== 演练完成 ===');
}

main().catch((error) => {
  console.error('执行失败:', error);
  process.exit(1);
});
