import { makeHmacRequest } from './helpers/hmac_request.js';

// Load Env
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';
const SHOT_ID = process.env.SHOT_ID;
const FRAME_KEYS_JSON = process.env.FRAME_KEYS;

if (!SHOT_ID || !FRAME_KEYS_JSON) {
  console.error('[Verify] SHOT_ID and FRAME_KEYS are required');
  process.exit(1);
}

const frameKeys = JSON.parse(FRAME_KEYS_JSON);

async function main() {
  console.warn(`[Verify] Triggering VIDEO_RENDER for Shot ${SHOT_ID}...`);

  // 1. Trigger
  const triggerRes = await makeHmacRequest({
    apiBaseUrl: API_BASE_URL,
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    method: 'POST',
    path: `/api/shots/${SHOT_ID}/jobs`,
    body: {
      type: 'VIDEO_RENDER',
      payload: {
        frameKeys,
        fps: 1,
      },
    },
  });

  if (triggerRes.status !== 201 && triggerRes.status !== 200) {
    console.error('[Verify] Trigger Failed:', JSON.stringify(triggerRes, null, 2));
    process.exit(1);
  }

  const jobId = triggerRes.response?.data?.id;
  if (!jobId) {
    console.error('[Verify] No Job ID returned:', JSON.stringify(triggerRes.response));
    process.exit(1);
  }
  console.warn(`[Verify] Job Created: ${jobId}. Polling...`);

  // 2. Poll
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await makeHmacRequest({
      apiBaseUrl: API_BASE_URL,
      apiKey: API_KEY,
      apiSecret: API_SECRET,
      method: 'GET',
      path: `/api/jobs/${jobId}`,
    });

    if (pollRes.status !== 200) {
      console.warn(`[Verify] Poll failed (status ${pollRes.status}), retrying...`);
      continue;
    }

    const job = pollRes.response?.data;
    const status = job?.status;
    const workerId = job?.workerId;
    console.warn(`[Verify] Status: ${status}, Worker: ${workerId}`);

    if (status === 'SUCCEEDED') {
      // Output JSON result to stdout for bash
      console.log(JSON.stringify(job));
      process.exit(0);
    } else if (status === 'FAILED') {
      console.error('[Verify] Job FAILED:', JSON.stringify(job));
      process.exit(1);
    }
  }

  console.error('[Verify] Timeout polling job');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
