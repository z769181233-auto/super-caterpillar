import axios from 'axios';
import crypto from 'crypto';

/**
 * Stage 3 Mock Worker R29 - BUSINESS HEADER ALIGNMENT
 * Fixed: Added 'x-worker-id' required by API for claim audit.
 */

const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';
const API_KEY = process.env.API_KEY || 'dev-worker-key';
const API_SECRET = process.env.API_SECRET || 'dev-worker-secret';
const WORKER_SUFFIX = process.env.WORKER_SUFFIX || '0';

function generateHmacHeaders(bodyObj: any, workerId?: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `mock_v29_${WORKER_SUFFIX}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Force non-empty body to align with API raw-body capture consistency
    const finalBody = (bodyObj && Object.keys(bodyObj).length > 0) ? bodyObj : { _mt: 1 };
    const bodyStr = JSON.stringify(finalBody);

    const message = API_KEY + nonce + timestamp + bodyStr;
    const signature = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');

    const headers: any = {
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json'
    };

    if (workerId) {
        headers['x-worker-id'] = workerId;
    }

    return { headers, data: finalBody };
}

async function main() {
    const workerId = `mock-s3-${WORKER_SUFFIX}-${Date.now()}`;
    console.log(`[MockWorker-${WORKER_SUFFIX}] Starting as ${workerId} (R29 BUSINESS-READY)`);

    // 1. Register
    try {
        const payload = {
            workerId,
            name: `Mock Worker ${WORKER_SUFFIX}`,
            capabilities: { supportedJobTypes: ['SHOT_RENDER'], supportedModels: ['mock-model-v1'], maxBatchSize: 1 },
            gpuCount: 0, gpuMemory: 0, gpuType: 'mock_gpu'
        };
        const hb = generateHmacHeaders(payload);
        await axios.post(`${API_URL}/api/workers/register`, hb.data, { headers: hb.headers });
        console.log(`[MockWorker-${WORKER_SUFFIX}] Registered.`);
    } catch (e: any) {
        console.error(`[MockWorker-${WORKER_SUFFIX}] Registration FAILED: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
        process.exit(1);
    }

    // 2. Main Loop
    for (let i = 0; i < 200; i++) {
        try {
            // Heartbeat
            const hPayload = { status: 'idle', tasksRunning: 0, temperature: 0 };
            const hHb = generateHmacHeaders(hPayload, workerId);
            await axios.post(`${API_URL}/api/workers/${workerId}/heartbeat`, hHb.data, { headers: hHb.headers });

            // Next Job
            const nHb = generateHmacHeaders({}, workerId);
            const nRes = await axios.post(`${API_URL}/api/workers/${workerId}/jobs/next`, nHb.data, { headers: nHb.headers });
            const job = nRes.data.data;

            if (job) {
                console.log(`[MockWorker-${WORKER_SUFFIX}] Job ${job.id}`);
                const ackPayload = { workerId };
                const aHb = generateHmacHeaders(ackPayload, workerId);
                await axios.post(`${API_URL}/api/jobs/${job.id}/ack`, aHb.data, { headers: aHb.headers });

                await new Promise(r => setTimeout(r, 1000));

                const compPayload = { status: 'SUCCEEDED', result: { output: { storageKey: `mock-${job.id}.png` } }, workerId };
                const cHb = generateHmacHeaders(compPayload, workerId);
                await axios.post(`${API_URL}/api/jobs/${job.id}/complete`, cHb.data, { headers: cHb.headers });
                console.log(`[MockWorker-${WORKER_SUFFIX}] Completed ${job.id}`);
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e: any) {
            console.error(`[MockWorker-${WORKER_SUFFIX}] Error: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

main();
