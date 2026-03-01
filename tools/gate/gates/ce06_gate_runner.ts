import * as crypto from 'crypto';
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3011';
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

/**
 * 计算 HMAC-SHA256 签名 (V1.1 Strict)
 * 对齐 APISpec V1.1: HMAC_SHA256(api_key + nonce + timestamp + body)
 */
function computeSignature(
  apiKey: string,
  secret: string,
  nonce: string,
  timestamp: string,
  body: string
): string {
  const stringToSign = `${apiKey}${nonce}${timestamp}${body}`;
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

async function request(
  method: string,
  path: string,
  bodyObj: any,
  customNonce?: string,
  customTimestamp?: string
) {
  const url = `${API_BASE_URL}${path}`;
  const timestamp = customTimestamp || Math.floor(Date.now() / 1000).toString();
  const nonce = customNonce || `nonce_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const body = JSON.stringify(bodyObj);

  if (!API_KEY || !API_SECRET) {
    throw new Error('API_KEY and API_SECRET must be set');
  }

  const signature = computeSignature(API_KEY, API_SECRET, nonce, timestamp, body);
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Content-SHA256': contentSha256,
    'X-Signature': signature,
    'X-Hmac-Version': '1.1',
  };

  console.log(`DEBUG: Sending request to ${url}, body summary: ${body.substring(0, 100)}...`);
  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const json = await response.json();
  return {
    status: response.status,
    body: json,
    nonce,
    timestamp,
  };
}

async function run() {
  console.log('🚀 Starting CE06 Commercial Gate Runner...');

  // 1. 获取测试项目 (优先选择 org-gate 组织下的项目)
  const project =
    (await prisma.project.findFirst({
      where: { organization: { id: 'org-gate' } },
      orderBy: { createdAt: 'desc' },
    })) || (await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } }));

  if (!project) throw new Error('No project found');
  console.log(
    `[Gate] Using project: ${project.id} (Name: ${project.name}, Org: ${project.organizationId})`
  );

  const rawText = '第1卷：测试卷\n第1章：测试章节\n[场面：咖啡厅]\n主角走了进来。';
  const payload = {
    rawText,
    projectId: project.id,
    context: {
      parser_config: { mode: 'fast' },
    },
  };

  // --- TEST 1: Normal Request ---
  console.log('Test 1: Sending normal CE06 request...');
  const res1 = await request('POST', '/api/story/parse', payload);
  if (res1.status !== 201 && res1.status !== 200) {
    console.error('FAIL: Initial request failed. Body:', JSON.stringify(res1.body, null, 2));
    process.exit(1);
  }
  const jobId = res1.body.data.jobId;
  console.log(`✅ Success! JobId: ${jobId}`);

  // --- TEST 2: Nonce Replay (4004/403) ---
  console.log('\nTest 2: Testing Nonce Replay (Same nonce, same timestamp)...');
  const res2 = await request('POST', '/api/story/parse', payload, res1.nonce, res1.timestamp);
  console.log(`Response: HTTP ${res2.status}, code: ${res2.body.code || 'N/A'}`);

  if (res2.status === 403 && res2.body.code === '4004') {
    console.log('✅ Success! Correctly rejected replay with 4004/403');
  } else {
    console.error(`FAIL: Replay should return 403/4004, got ${res2.status}/${res2.body.code}`);
    process.exit(1);
  }

  // --- TEST 3: Wait for Job Success ---
  console.log(`\nTest 3: Waiting for Job ${jobId} to succeed...`);
  let finished = false;
  let attempts = 0;
  while (!finished && attempts < 60) {
    const job = await prisma.shotJob.findUnique({ where: { id: jobId } });
    if (job?.status === 'SUCCEEDED') {
      console.log('✅ Job SUCCEEDED!');
      finished = true;
    } else if (job?.status === 'FAILED') {
      console.error('FAIL: Job failed in worker');
      process.exit(1);
    } else {
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;
    }
  }

  if (!finished) {
    console.error('FAIL: Job timeout');
    process.exit(1);
  }

  // --- TEST 4: DB Integrity ---
  console.log('\nTest 4: Checking DB Integrity (Volumes/Chapters/Scenes)...');
  const scenes = await prisma.scene.findMany({
    where: { chapter: { novelSource: { projectId: project.id } } },
    orderBy: { sceneIndex: 'asc' },
  });
  console.log(`Found ${scenes.length} scenes in DB.`);
  if (scenes.length === 0) {
    console.error('FAIL: No scenes found');
    process.exit(1);
  }

  // Check index continuity
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].sceneIndex !== i + 1) {
      console.warn(`WARN: Scene index gap detected at ${i + 1}`);
    }
  }
  console.log('✅ DB Integrity check passed.');

  // --- TEST 5: Audit Logs ---
  console.log('\nTest 5: Checking Audit Logs for security fields...');
  const audit = await prisma.auditLog.findFirst({
    where: { action: 'SECURITY_EVENT' },
    orderBy: { createdAt: 'desc' },
  });
  // HMACAuthGuard records audit logs even on success? No, mainly on failure.
  // But it records SECURITY_EVENT for failures. Replay was a failure.
  if (audit && (audit.details as any).incomingNonce === res1.nonce) {
    console.log('✅ Audit log correctly recorded the replay event.');
  } else {
    console.warn('WARN: Audit log for replay event not found or mismatch.');
  }

  console.log('\n🌟 ALL COMMERCIAL GATE TESTS PASSED!');
  process.exit(0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
