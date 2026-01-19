const { PrismaClient } = require('../packages/database/src/generated/prisma');
const axios = require('axios');
const crypto = require('crypto');
// const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

// Helper: UUID v4 fallback
function genUUID() {
  return crypto.randomUUID();
}

// Helper: HMAC
function generateSignatureV1_1(apiKey, secret, nonce, timestamp, body) {
  // Server uses contentSha256. So we must hash the body first.
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalString = `${apiKey}${nonce}${timestamp}${bodyHash}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalString);
  return hmac.digest('hex');
}

async function verifyPipelineE2EVideo() {
  console.log('🚀 Starting Verification: PIPELINE_E2E_VIDEO (JS Version)...');

  const orgId = 'verify-org-' + genUUID();
  const userId = 'verify-user-' + genUUID();
  const projectId = 'verify-proj-' + genUUID();
  const apiKeyStr = 'ak_test_' + genUUID();
  const apiSecret = 'sk_test_' + genUUID();

  try {
    try {
      await prisma.organization.create({
        data: {
          id: orgId,
          name: 'Verify Org',
          slug: orgId,
          owner: {
            create: {
              id: userId,
              email: `${userId}@example.com`,
              passwordHash: 'mock_hash_for_verification',
            },
          },
        },
      });
    } catch (e) {
      if (e.code !== 'P2002') throw e;
    }

    // try {
    //     await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, username: userId, organizationId: orgId } });
    // } catch (e) { if (e.code !== 'P2002') throw e; }

    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Verify Pipeline Project',
        organizationId: orgId,
        ownerId: userId,
      },
    });
    await prisma.apiKey.create({
      data: {
        key: apiKeyStr,
        secretHash: apiSecret, // Fallback allows plain text in dev
        ownerOrgId: orgId,
        ownerUserId: userId,
        name: 'Verify Key',
        status: 'ACTIVE',
      },
    });
    console.log('✅ Test data setup complete.');
  } catch (e) {
    console.error('❌ Setup failed:', e);
    process.exit(1);
  }

  console.log('📡 Calling POST /story/parse with V1.1 Signature...');
  const nonce = genUUID();
  const timestamp = Date.now().toString();
  const bodyObj = { projectId: projectId, rawText: 'Verification Text' };
  const bodyStr = JSON.stringify(bodyObj);
  const signature = generateSignatureV1_1(apiKeyStr, apiSecret, nonce, timestamp, bodyStr);

  try {
    const resp = await axios.post(`${API_URL}/ce-engine/story/parse`, bodyObj, {
      headers: {
        'X-Api-Key': apiKeyStr,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ API Call Successful:', resp.data);

    const { jobId } = resp.data;
    if (!jobId) throw new Error('Missing jobId');

    // Verify Job Created and Pipeline Intact
    // We check if the job exists and has the correct task type
    const job = await prisma.shotJob.findUnique({ where: { id: jobId }, include: { task: true } });
    if (!job) throw new Error('Job not found in DB');

    const payload = job.task.payload || {};
    const pipeline = payload.pipeline || [];
    console.log('🔍 Pipeline Plan:', pipeline);

    const expected = [
      'CE06_NOVEL_PARSING',
      'CE03_VISUAL_DENSITY',
      'CE04_VISUAL_ENRICHMENT',
      'TIMELINE_RENDER',
      'CE09_MEDIA_SECURITY',
    ];
    const isValid = expected.every((step) => pipeline.includes(step));

    if (!isValid) {
      throw new Error('Pipeline plan does not match expected E2E sequence');
    }
    console.log('✅ Pipeline Plan Valid.');
    console.log('✅ Verification Verification PASSED.');
  } catch (err) {
    console.error('❌ Verification Failed:', err.message);
    if (err.response) {
      console.error('Data:', err.response.data);
    }
    process.exit(1);
  }
}

verifyPipelineE2EVideo();
