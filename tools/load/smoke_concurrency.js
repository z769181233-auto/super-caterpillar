#!/usr/bin/env node
/**
 * 最小并发冒烟压测脚本
 * 支持 CONCURRENCY=10 和 CONCURRENCY=50
 */

const fs = require('fs');
const path = require('path');
const hmacLib = require('../security/hmac-lib');

// 配置
// 支持命令行参数：--concurrency 10 --max 100
let CONCURRENCY = parseInt(process.env.CONCURRENCY || '10', 10);
let MAX_REQUESTS = Math.min(500, CONCURRENCY * 10);
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--concurrency' && process.argv[i + 1]) {
    CONCURRENCY = parseInt(process.argv[i + 1], 10);
  }
  if (process.argv[i] === '--max' && process.argv[i + 1]) {
    MAX_REQUESTS = parseInt(process.argv[i + 1], 10);
  }
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const PROJECT_ID = process.env.PROJECT_ID || 'test-project-id';
const API_KEY = process.env.API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET =
  process.env.API_SECRET ||
  'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';
const POLL_INTERVAL = 1000; // 1秒
const MAX_POLLS = 30; // 最多轮询30次
const TIMEOUT_MS = MAX_POLLS * POLL_INTERVAL; // 30秒超时

const OUTPUT_FILE = path.join(__dirname, '../../docs/_risk', `load_smoke_${CONCURRENCY}.json`);

// 确保输出目录存在
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 生成随机ID
function randomId() {
  return Math.random().toString(36).substring(2, 15);
}

// 发送请求（使用原生 http）
async function sendRequest(method, url, body, headers = {}) {
  const startTime = Date.now();
  const http = require('http');
  const https = require('https');
  const { URL } = require('url');

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const bodyString = body ? JSON.stringify(body) : '';

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (bodyString) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let responseBody;
        try {
          responseBody = JSON.parse(data);
        } catch {
          responseBody = { raw: data };
        }

        resolve({
          status: res.statusCode,
          duration,
          body: responseBody,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        status: 0,
        duration,
        body: { error: error.message },
        success: false,
        error: error.message,
      });
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

// 轮询任务状态（简化版：直接返回成功，不实际轮询）
async function pollTaskStatus(taskId) {
  // 为了简化压测，我们直接返回成功
  // 实际场景中应该轮询真实的任务状态接口
  await new Promise((resolve) => setTimeout(resolve, 100)); // 模拟短暂延迟
  return { success: true, duration: 100, pollCount: 1 };
}

// 执行单个任务
async function executeTask(taskIndex, apiKey, apiSecret) {
  const taskStartTime = Date.now();

  try {
    // 使用仅 HMAC 的健康检查接口：GET /api/_internal/hmac-ping
    // 这个接口只需要 HMAC 验证，不需要 JWT，适合压测
    const method = 'GET';
    const requestPath = '/api/_internal/hmac-ping'; // 用于签名的路径（含 /api 前缀）

    // 使用共享的 HMAC 库生成签名头
    const headers = hmacLib.generateHmacHeaders(apiKey, apiSecret, method, requestPath, null);

    const result = await sendRequest(method, `${API_BASE_URL}${requestPath}`, null, headers);

    // 解析错误码
    let errorCode = null;
    if (result.body && typeof result.body === 'object') {
      if (result.body.error) {
        errorCode = result.body.error.code;
      }
    }

    // 判断是否通过 HMAC 验证
    const hmacRejected = errorCode === '4003' || errorCode === '4004';
    const jwtRejected = result.status === 401 && !hmacRejected;
    const ok = result.status >= 200 && result.status < 300;

    return {
      taskIndex,
      success: ok, // 只有 2xx 才算成功
      duration: Date.now() - taskStartTime,
      status: result.status,
      errorCode,
      hmacRejected,
      jwtRejected,
      ok,
    };
  } catch (error) {
    return {
      taskIndex,
      success: false,
      duration: Date.now() - taskStartTime,
      status: 0,
      error: error.message,
    };
  }
}

// 并发执行
async function runConcurrencyTest() {
  console.log(`开始并发压测: CONCURRENCY=${CONCURRENCY}, MAX_REQUESTS=${MAX_REQUESTS}`);

  const results = [];
  const batches = Math.ceil(MAX_REQUESTS / CONCURRENCY);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * CONCURRENCY;
    const batchEnd = Math.min(batchStart + CONCURRENCY, MAX_REQUESTS);
    const batchSize = batchEnd - batchStart;

    console.log(`批次 ${batch + 1}/${batches}: 执行 ${batchSize} 个任务`);

    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(executeTask(i, API_KEY, API_SECRET));
    }

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 批次间短暂延迟
    if (batch < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 统计
  const total = results.length;
  const success = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success).length;
  const timeout = results.filter((r) => r.timeout).length;

  // HMAC/JWT 拒绝统计
  const hmacRejected = results.filter((r) => r.hmacRejected).length;
  const jwtRejected = results.filter((r) => r.jwtRejected).length;
  const ok = results.filter((r) => r.ok).length;

  const durations = results.map((r) => r.duration).filter((d) => d > 0);
  const avgMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // 计算 P95
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  const p95Ms = sortedDurations.length > 0 ? sortedDurations[p95Index] : 0;

  // 按状态码/错误类型聚合
  const errorsByCode = {};
  results.forEach((r) => {
    if (!r.success) {
      const code = r.status || 'NETWORK_ERROR';
      const errorType = r.errorCode || r.error || 'Unknown';
      const key = `${code}:${errorType}`;
      errorsByCode[key] = (errorsByCode[key] || 0) + 1;
    }
  });

  const summary = {
    total,
    success,
    fail,
    timeout,
    hmac_rejected: hmacRejected,
    jwt_rejected: jwtRejected,
    ok,
    avg_ms: Math.round(avgMs),
    p95_ms: Math.round(p95Ms),
    errors_by_code: errorsByCode,
    concurrency: CONCURRENCY,
    max_requests: MAX_REQUESTS,
    timestamp: new Date().toISOString(),
  };

  // 保存结果
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));

  console.log('\n压测结果:');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\n结果已保存到: ${OUTPUT_FILE}`);

  return summary;
}

// 运行
runConcurrencyTest().catch((error) => {
  console.error('压测失败:', error);
  process.exit(1);
});
