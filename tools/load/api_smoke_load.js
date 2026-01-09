#!/usr/bin/env node

/**
 * API 负载测试脚本（真实端点版本）
 * 测试 POST /api/shots/:shotId/jobs 创建 job 的性能
 *
 * 使用方法:
 *   node tools/load/api_smoke_load.js [options]
 *
 * 选项:
 *   --url <url>          API 基础 URL (默认: http://localhost:3000)
 *   --concurrent <n>     并发请求数 (默认: 10)
 *   --requests <n>       总请求数 (默认: 100)
 *   --shot-id <id>       Shot ID (必需)
 *   --job-type <type>    Job 类型 (默认: VIDEO_RENDER)
 *   --auth-token <token> JWT token (必需)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  url: 'http://localhost:3000',
  concurrent: 10,
  requests: 100,
  shotId: null,
  jobType: 'VIDEO_RENDER',
  authToken: null,
  json: false,
  out: null,
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (key === '--url') options.url = value;
  else if (key === '--concurrent') options.concurrent = parseInt(value, 10);
  else if (key === '--requests') options.requests = parseInt(value, 10);
  else if (key === '--shot-id') options.shotId = value;
  else if (key === '--job-type') options.jobType = value;
  else if (key === '--auth-token') options.authToken = value;
  else if (key === '--json') options.json = value === 'true' || value === '1';
  else if (key === '--out') options.out = value;
}

if (!options.shotId) {
  console.error('❌ Error: --shot-id is required');
  process.exit(1);
}

if (!options.authToken) {
  console.error('❌ Error: --auth-token is required');
  process.exit(1);
}

const baseUrl = new URL(options.url);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

// 统计信息
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  capacityExceeded: 0, // 容量超限
  errors: [],
  responseTimes: [],
  startTime: Date.now(),
};

// 执行单个请求
function makeRequest() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const path = `/api/shots/${options.shotId}/jobs`;
    const url = new URL(path, options.url);

    const body = JSON.stringify({
      type: options.jobType,
      payload: {
        test: true,
        loadTest: true,
        timestamp: Date.now(),
      },
    });

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${options.authToken}`,
        'User-Agent': 'SCU-LoadTest/1.0',
      },
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        stats.responseTimes.push(responseTime);

        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          parsedData = { raw: data };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.success++;
        } else if (res.statusCode === 429) {
          // 容量超限
          stats.capacityExceeded++;
          stats.failed++;
          stats.errors.push({
            statusCode: res.statusCode,
            errorCode: parsedData.error?.code || 'UNKNOWN',
            responseTime,
          });
        } else {
          stats.failed++;
          stats.errors.push({
            statusCode: res.statusCode,
            message: parsedData.message || parsedData.error?.message || 'Unknown error',
            responseTime,
          });
        }
        stats.total++;
        resolve();
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      stats.responseTimes.push(responseTime);
      stats.failed++;
      stats.errors.push({
        error: error.message,
        responseTime,
      });
      stats.total++;
      resolve();
    });

    req.setTimeout(30000, () => {
      req.destroy();
      stats.failed++;
      stats.errors.push({ error: 'Request timeout', responseTime: 30000 });
      stats.total++;
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// 并发控制
async function runLoadTest() {
  console.log(`\n🚀 Starting API Load Test (Real Endpoint)...`);
  console.log(`   URL: ${options.url}`);
  console.log(`   Endpoint: POST /api/shots/${options.shotId}/jobs`);
  console.log(`   Job Type: ${options.jobType}`);
  console.log(`   Concurrent: ${options.concurrent}`);
  console.log(`   Total Requests: ${options.requests}\n`);

  const startTime = Date.now();
  const queue = [];
  let completed = 0;

  // 创建请求队列
  for (let i = 0; i < options.requests; i++) {
    queue.push(makeRequest);
  }

  // 并发执行
  while (queue.length > 0 || completed < options.requests) {
    const batch = queue.splice(0, options.concurrent);
    if (batch.length > 0) {
      await Promise.all(batch.map((fn) => fn().then(() => completed++)));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // 计算统计信息
  const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  const avg = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
  const min = Math.min(...stats.responseTimes);
  const max = Math.max(...stats.responseTimes);

  const successRate = stats.success / stats.total;
  const p95Threshold = 500; // 500ms
  const rps = stats.total / duration;

  const result = {
    url: options.url,
    endpoint: `POST /api/shots/${options.shotId}/jobs`,
    jobType: options.jobType,
    concurrent: options.concurrent,
    requests: options.requests,
    total: stats.total,
    success: stats.success,
    failed: stats.failed,
    capacityExceeded: stats.capacityExceeded,
    durationSec: duration,
    rps,
    latencyMs: { min, max, avg, p50, p95, p99 },
    successRate,
    capacityExceededRate: stats.capacityExceeded / stats.total,
    threshold: { p95Ms: p95Threshold, successRate: 0.95 },
    pass: successRate >= 0.95 && p95 <= p95Threshold,
    ts: new Date().toISOString(),
  };

  // JSON 输出模式：仅输出 JSON + 可选写入文件，不打印人类可读内容
  if (options.json) {
    const jsonText = JSON.stringify(result, null, 2);
    if (options.out) {
      fs.writeFileSync(options.out, jsonText, 'utf8');
    }
    console.log(jsonText);
    process.exit(result.pass ? 0 : 1);
  }

  // 输出人类可读结果
  console.log('\n📊 Load Test Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Requests:     ${stats.total}`);
  console.log(
    `Successful:        ${stats.success} (${((stats.success / stats.total) * 100).toFixed(2)}%)`
  );
  console.log(
    `Failed:            ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(2)}%)`
  );
  console.log(
    `Capacity Exceeded: ${stats.capacityExceeded} (${((stats.capacityExceeded / stats.total) * 100).toFixed(2)}%)`
  );
  console.log(`Duration:          ${duration.toFixed(2)}s`);
  console.log(`Requests/sec:      ${(stats.total / duration).toFixed(2)}`);
  console.log('\nResponse Times (ms):');
  console.log(`  Min:             ${min}`);
  console.log(`  Max:             ${max}`);
  console.log(`  Average:         ${avg.toFixed(2)}`);
  console.log(`  P50:             ${p50}`);
  console.log(`  P95:             ${p95}`);
  console.log(`  P99:             ${p99}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (stats.errors.length > 0 && stats.errors.length <= 20) {
    console.log('⚠️  Errors (first 20):');
    const errorSummary = {};
    stats.errors.forEach((err) => {
      const key = err.statusCode || err.errorCode || err.error || 'unknown';
      errorSummary[key] = (errorSummary[key] || 0) + 1;
    });
    Object.entries(errorSummary).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
    console.log('');
  }

  // 判断测试是否通过（人类可读模式）
  if (successRate < 0.95) {
    console.log(`❌ Test failed: Success rate ${(successRate * 100).toFixed(2)}% < 95%`);
    process.exit(1);
  } else if (p95 > p95Threshold) {
    console.log(`❌ Test failed: P95 ${p95}ms > ${p95Threshold}ms`);
    process.exit(1);
  } else {
    console.log(`✅ Test passed: Success rate ${(successRate * 100).toFixed(2)}%, P95 ${p95}ms`);
    process.exit(0);
  }
}

runLoadTest().catch((error) => {
  console.error('❌ Load test failed:', error);
  process.exit(1);
});
