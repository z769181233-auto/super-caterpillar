import axios from 'axios';
import { randomUUID } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN;
const WORKER_SUFFIX = process.env.WORKER_SUFFIX || '0';

if (!TEST_TOKEN) {
    console.error('TEST_TOKEN is required');
    process.exit(1);
}

const AUTHORIZATION = `Bearer ${TEST_TOKEN}`;

async function main() {
    const workerId = `mock-s3-${WORKER_SUFFIX}-${Date.now()}`;
    console.log(`[MockWorker-${WORKER_SUFFIX}] Starting as ${workerId}`);

    // 1. Register
    try {
        await axios.post(
            `${API_URL}/api/workers/register`,
            {
                workerId,
                name: `Stage3 Mock Worker ${WORKER_SUFFIX}`,
                capabilities: {
                    supportedJobTypes: ['SHOT_RENDER'],
                    supportedModels: ['mock-model-v1'],
                    maxBatchSize: 1
                },
                gpuCount: 0,
                gpuMemory: 0,
                gpuType: 'mock_gpu',
            },
            { headers: { Authorization: AUTHORIZATION } }
        );
        console.log(`[MockWorker-${WORKER_SUFFIX}] Registered successfully`);
    } catch (error: any) {
        console.error(`[MockWorker-${WORKER_SUFFIX}] Registration failed: ${error.message}`);
        process.exit(1);
    }

    // Loop
    // Run loop to process jobs
    const maxLoops = 100;

    for (let i = 0; i < maxLoops; i++) {
        try {
            // Heartbeat
            await axios.post(
                `${API_URL}/api/workers/${workerId}/heartbeat`,
                { status: 'idle', tasksRunning: 0, temperature: 0 },
                { headers: { Authorization: AUTHORIZATION } }
            );

            // Get Next Job
            const nextRes = await axios.post(
                `${API_URL}/api/workers/${workerId}/jobs/next`,
                {},
                {
                    headers: {
                        Authorization: AUTHORIZATION,
                        'x-worker-id': workerId
                    }
                }
            );

            const job = nextRes.data.data;
            if (job) {
                console.log(`[MockWorker-${WORKER_SUFFIX}] Claimed job ${job.id} (${job.type})`);

                // Ack
                await axios.post(
                    `${API_URL}/api/jobs/${job.id}/ack`,
                    { workerId },
                    { headers: { Authorization: AUTHORIZATION, 'x-worker-id': workerId } }
                );

                // Simulate work (random delay 1-3s)
                const delay = Math.floor(Math.random() * 2000) + 1000;
                await new Promise(r => setTimeout(r, delay));

                // Complete with Storage Key for DAG
                const storageKey = `mock-frame-${job.id}.png`;
                await axios.post(
                    `${API_URL}/api/jobs/${job.id}/complete`,
                    {
                        status: 'SUCCEEDED',
                        result: {
                            output: {
                                storageKey,
                                simulated: true
                            }
                        },
                        workerId
                    },
                    { headers: { Authorization: AUTHORIZATION, 'x-worker-id': workerId } }
                );
                console.log(`[MockWorker-${WORKER_SUFFIX}] Completed job ${job.id} with key ${storageKey}`);
            } else {
                // Exponential backoff or simple sleep
                await new Promise(r => setTimeout(r, 1000));
            }

        } catch (error: any) {
            console.error(`[MockWorker-${WORKER_SUFFIX}] Error: ${error.message}`);
        }
    }
}

main();
