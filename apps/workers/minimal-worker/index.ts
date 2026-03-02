/**
 * Stage2-B: 最小真实 Worker 执行闭环
 *
 * 功能：
 * 1. 轮询调用 POST /api/workers/{workerId}/jobs/next
 * 2. 若无 job，sleep 3s
 * 3. 若有 job：
 *    - 立即上报 RUNNING (POST /api/jobs/:id/start)
 *    - sleep(2~5 秒)
 *    - 上报 SUCCEEDED (POST /api/jobs/:id/report)
 * 4. 每 10 秒发送 heartbeat (POST /api/workers/:workerId/heartbeat)
 */

import { createHmac, randomBytes, createHash } from 'crypto';
import * as util from 'util';

console.log('API_BASE_URL:', process.env.API_BASE_URL);
const baseUrl = process.env.API_BASE_URL;
if (!baseUrl) {
  throw new Error('API_BASE_URL is required in production');
}
const API_BASE_URL = baseUrl;
const API_KEY = process.env.API_KEY || '';
const API_SECRET = process.env.API_SECRET || '';
const WORKER_ID = process.env.WORKER_ID || 'minimal-worker-001';

/**
 * 生成随机 nonce
 */
function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 构建 HMAC 签名消息
 */
function buildMessage(apiKey: string, nonce: string, timestamp: string, body: string): string {
  return `${apiKey}${nonce}${timestamp}${body || ''}`;
}

/**
 * 计算 HMAC-SHA256 签名
 */
function computeSignature(secret: string, message: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * 生成 HMAC 认证头
 */
function generateHmacHeaders(body: string = '') {
  const nonce = generateNonce();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = buildMessage(API_KEY, nonce, timestamp, body);
  const signature = computeSignature(API_SECRET, message);

  return {
    'X-Api-Key': API_KEY,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Content-SHA256': createHash('sha256').update(body).digest('hex'),
    'X-Signature': signature,
    'Content-Type': 'application/json',
  };
}

/**
 * 发送 HTTP 请求
 */
async function httpRequest(method: string, path: string, body?: any): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = generateHmacHeaders(bodyStr);

  const response = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Worker 心跳
 */
async function sendHeartbeat(): Promise<void> {
  try {
    const result = await httpRequest('POST', `/api/workers/${WORKER_ID}/heartbeat`, {
      status: 'idle',
      tasksRunning: 0,
    });
    process.stdout.write(
      util.format(`[${new Date().toISOString()}] ✅ Heartbeat sent:`, result) + '\n'
    );
  } catch (error: any) {
    process.stderr.write(
      util.format(`[${new Date().toISOString()}] ❌ Heartbeat failed:`, error.message) + '\n'
    );
  }
}

/**
 * 拉取下一个 Job
 */
async function fetchNextJob(): Promise<any | null> {
  try {
    const result = await httpRequest('POST', `/api/workers/${WORKER_ID}/jobs/next`);

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error: any) {
    process.stderr.write(
      util.format(`[${new Date().toISOString()}] ❌ Fetch job failed:`, error.message) + '\n'
    );
    return null;
  }
}

/**
 * 上报 Job 开始执行（DISPATCHED → RUNNING）
 */
async function reportJobRunning(jobId: string): Promise<void> {
  try {
    const result = await httpRequest('POST', `/api/jobs/${jobId}/start`, {
      workerId: WORKER_ID,
    });
    process.stdout.write(
      util.format(`[${new Date().toISOString()}] ✅ Job ${jobId} marked as RUNNING:`, result) + '\n'
    );
  } catch (error: any) {
    process.stderr.write(
      util.format(`[${new Date().toISOString()}] ❌ Report RUNNING failed:`, error.message) + '\n'
    );
    throw error;
  }
}

/**
 * 上报 Job 执行结果（RUNNING → SUCCEEDED）
 */
async function reportJobSucceeded(jobId: string, output: any): Promise<void> {
  try {
    const result = await httpRequest('POST', `/api/jobs/${jobId}/report`, {
      status: 'SUCCEEDED',
      output,
    });
    process.stdout.write(
      util.format(`[${new Date().toISOString()}] ✅ Job ${jobId} reported as SUCCEEDED:`, result) +
      '\n'
    );
  } catch (error: any) {
    process.stderr.write(
      util.format(`[${new Date().toISOString()}] ❌ Report SUCCEEDED failed:`, error.message) + '\n'
    );
    throw error;
  }
}

/**
 * 处理一个 Job
 */
async function processJob(job: any): Promise<void> {
  const jobId = job.id;
  const jobType = job.type;

  process.stdout.write(
    util.format(`[${new Date().toISOString()}] 📦 Processing job ${jobId} (${jobType})`) + '\n'
  );

  try {
    // 1. 上报 RUNNING
    await reportJobRunning(jobId);

    // 2. 模拟执行（sleep 2~5 秒）
    const durationMs = 2000 + Math.random() * 3000;
    process.stdout.write(
      util.format(
        `[${new Date().toISOString()}] ⏳ Executing job ${jobId} (${Math.round(durationMs)}ms)...`
      ) + '\n'
    );
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // 3. 上报 SUCCEEDED
    await reportJobSucceeded(jobId, {
      worker: 'minimal-worker',
      durationMs: Math.round(durationMs),
      completedAt: new Date().toISOString(),
    });

    process.stdout.write(
      util.format(`[${new Date().toISOString()}] ✅ Job ${jobId} completed successfully`) + '\n'
    );
  } catch (error: any) {
    process.stderr.write(
      util.format(
        `[${new Date().toISOString()}] ❌ Job ${jobId} processing failed:`,
        error.message
      ) + '\n'
    );
  }
}

/**
 * 主循环
 */
async function main() {
  process.stdout.write(util.format('=== Stage2-B Minimal Worker ===') + '\n');
  process.stdout.write(util.format(`Worker ID: ${WORKER_ID}`) + '\n');
  process.stdout.write(util.format(`API Base URL: ${API_BASE_URL}`) + '\n');
  process.stdout.write(util.format(`API Key: ${API_KEY.substring(0, 10)}...`) + '\n');
  process.stdout.write(util.format('') + '\n');

  // 立即发送一次心跳
  await sendHeartbeat();

  // 启动心跳定时器（每 10 秒）
  const heartbeatInterval = setInterval(() => {
    sendHeartbeat().catch(console.error);
  }, 10000);

  // 主循环：轮询 Job
  let consecutiveEmptyPolls = 0;

  while (true) {
    try {
      const job = await fetchNextJob();

      if (job) {
        consecutiveEmptyPolls = 0;
        await processJob(job);
      } else {
        consecutiveEmptyPolls++;
        if (consecutiveEmptyPolls % 10 === 0) {
          process.stdout.write(
            util.format(
              `[${new Date().toISOString()}] 💤 No job available (poll ${consecutiveEmptyPolls})`
            ) + '\n'
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 3000)); // sleep 3s
      }
    } catch (error: any) {
      process.stderr.write(
        util.format(`[${new Date().toISOString()}] ❌ Main loop error:`, error.message) + '\n'
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // 清理（理论上不会执行到这里）
  clearInterval(heartbeatInterval);
}

// 启动 Worker
main().catch((error) => {
  process.stderr.write(util.format('Fatal error:', error) + '\n');
  process.exit(1);
});
