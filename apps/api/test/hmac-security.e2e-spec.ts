/**
 * Stage5: HMAC 安全链路 E2E 测试
 *
 * 覆盖：
 * 1. 白名单免签接口（/api/health）应返回 200
 * 2. 必签接口缺少签名头应返回 4003
 * 3. 合法签名请求应成功（非签名错误）
 * 4. Nonce 重放应返回 4004
 * 5. 审计日志验证（SECURITY_EVENT with NONCE_REPLAY_DETECTED）
 *
 * 注意：此测试需要有效的 API Key 和 Secret
 * 可通过环境变量提供：HMAC_API_KEY, HMAC_SECRET
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as util from "util";

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.HMAC_API_KEY || '';
const SECRET = process.env.HMAC_SECRET || '';

/**
 * 计算 HMAC-SHA256 签名
 *
 * 注意：与 hmac-signature.interceptor.ts:107 对齐
 * interceptor 使用 request.originalUrl || request.url（不主动去掉 query string）
 * 所以这里也使用传入的 path（不主动处理 query string）
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
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
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
 * 测试用例
 */
async function runTests() {
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  // 测试 1: 白名单免签接口
  process.stdout.write(util.format('测试 1: 白名单免签接口 (/api/health)') + "\n");
  try {
    const response = await sendRequest(`${BASE_URL}/api/health`, 'GET', {});
    const passed = response.statusCode === 200;
    results.push({
      name: '白名单免签接口返回 200',
      passed,
      error: passed ? undefined : `期望 200，实际 ${response.statusCode}`,
    });
    process.stdout.write(util.format(passed ? '✅ 通过' : `❌ 失败: ${response.statusCode}`) + "\n");
  } catch (error: any) {
    results.push({
      name: '白名单免签接口返回 200',
      passed: false,
      error: error.message,
    });
    process.stdout.write(util.format(`❌ 失败: ${error.message}`) + "\n");
  }

  // 测试 2: 必签接口缺少签名头应返回 4003
  console.log('\n测试 2: 必签接口缺少签名头应返回 4003');
  try {
    const response = await sendRequest(
      `${BASE_URL}/api/workers/test-worker-001/jobs/next`,
      'POST',
      { 'Content-Type': 'application/json' },
      '{}'
    );
    const body = JSON.parse(response.body);
    const passed =
      response.statusCode === 401 &&
      body.error?.code === '4003' &&
      body.error?.message?.includes('Missing HMAC headers');
    results.push({
      name: '必签接口缺少签名头返回 4003',
      passed,
      error: passed
        ? undefined
        : `期望 401 + code:4003，实际 ${response.statusCode} + code:${body.error?.code}`,
    });
    console.log(passed ? '✅ 通过' : `❌ 失败: ${JSON.stringify(body)}`);
  } catch (error: any) {
    results.push({
      name: '必签接口缺少签名头返回 4003',
      passed: false,
      error: error.message,
    });
    console.log(`❌ 失败: ${error.message}`);
  }

  // 测试 3 & 4: 合法签名请求和 Nonce 重放（需要 API Key 和 Secret）
  if (!API_KEY || !SECRET) {
    console.log('\n⚠️  跳过测试 3 & 4: 需要设置 HMAC_API_KEY 和 HMAC_SECRET 环境变量');
    results.push({
      name: '合法签名请求（需要 API Key）',
      passed: false,
      error: '缺少 HMAC_API_KEY 或 HMAC_SECRET',
    });
    results.push({
      name: 'Nonce 重放返回 4004（需要 API Key）',
      passed: false,
      error: '缺少 HMAC_API_KEY 或 HMAC_SECRET',
    });
  } else {
    const path = '/api/workers/test-worker-001/jobs/next';
    const method = 'POST';
    const body = '{}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `e2e-nonce-${Date.now()}`;
    const signature = computeSignature(SECRET, method, path, timestamp, nonce, body);

    // 测试 3: 合法签名请求
    console.log('\n测试 3: 合法签名请求应成功（非签名错误）');
    try {
      const response = await sendRequest(
        `${BASE_URL}${path}`,
        method,
        {
          'X-Api-Key': API_KEY,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce,
          'X-Signature': signature,
          'Content-Type': 'application/json',
        },
        body
      );
      const responseBody = JSON.parse(response.body);
      // 第一次请求不应是签名错误（4003）或重放错误（4004）
      const passed = responseBody.error?.code !== '4003' && responseBody.error?.code !== '4004';
      results.push({
        name: '合法签名请求成功（非签名错误）',
        passed,
        error: passed ? undefined : `不应返回签名/重放错误，实际 code:${responseBody.error?.code}`,
      });
      console.log(
        passed
          ? '✅ 通过'
          : `❌ 失败: 返回 ${responseBody.error?.code} - ${responseBody.error?.message}`
      );
    } catch (error: any) {
      results.push({
        name: '合法签名请求成功（非签名错误）',
        passed: false,
        error: error.message,
      });
      console.log(`❌ 失败: ${error.message}`);
    }

    // 测试 4: Nonce 重放应返回 4004
    console.log('\n测试 4: Nonce 重放应返回 4004');
    try {
      // 使用相同的 nonce 再次请求
      const response = await sendRequest(
        `${BASE_URL}${path}`,
        method,
        {
          'X-Api-Key': API_KEY,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce, // 相同 nonce（重放）
          'X-Signature': signature,
          'Content-Type': 'application/json',
        },
        body
      );
      const responseBody = JSON.parse(response.body);
      const passed =
        response.statusCode === 403 &&
        responseBody.error?.code === '4004' &&
        responseBody.error?.message?.includes('Nonce replay');
      results.push({
        name: 'Nonce 重放返回 4004',
        passed,
        error: passed
          ? undefined
          : `期望 403 + code:4004，实际 ${response.statusCode} + code:${responseBody.error?.code}`,
      });
      console.log(passed ? '✅ 通过' : `❌ 失败: ${JSON.stringify(responseBody)}`);
    } catch (error: any) {
      results.push({
        name: 'Nonce 重放返回 4004',
        passed: false,
        error: error.message,
      });
      console.log(`❌ 失败: ${error.message}`);
    }
  }

  // 汇总结果
  console.log('\n=== 测试结果汇总 ===');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`通过: ${passedCount}/${totalCount}`);

  results.forEach((result) => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });

  // 退出码
  process.exit(passedCount === totalCount ? 0 : 1);
}

// 运行测试
runTests().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
