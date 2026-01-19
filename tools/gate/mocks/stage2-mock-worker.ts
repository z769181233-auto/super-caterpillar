import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_TOKEN = process.env.TEST_TOKEN;

if (!TEST_TOKEN) {
  console.error('TEST_TOKEN is required');
  process.exit(1);
}

const AUTHORIZATION = `Bearer ${TEST_TOKEN}`;

async function main() {
  const workerId = `mock-s2-${Date.now()}`;
  console.log(`[MockWorker] Starting as ${workerId}`);

  // 1. Register
  try {
    await axios.post(
      `${API_URL}/api/workers/register`,
      {
        workerId,
        name: 'Stage2 Mock Worker',
        capabilities: {
          supportedJobTypes: ['SHOT_RENDER'],
          supportedModels: ['mock-model-v1'],
          maxBatchSize: 1,
        },
        gpuCount: 0,
        gpuMemory: 0,
        gpuType: 'mock_gpu',
      },
      { headers: { Authorization: AUTHORIZATION } }
    );
    console.log(`[MockWorker] Registered successfully`);
  } catch (error: any) {
    console.error(`[MockWorker] Registration failed: ${error.message}`);
    if (error.response) {
      console.error('Response Data:', JSON.stringify(error.response.data));
    }
    process.exit(1);
  }

  // Loop
  let jobProcessed = false;
  // Run for a limited time or number of jobs for the gate
  const maxLoops = 20;

  for (let i = 0; i < maxLoops; i++) {
    try {
      // Heartbeat
      await axios.post(
        `${API_URL}/api/workers/${workerId}/heartbeat`,
        { status: 'idle', tasksRunning: 0, temperature: 0 },
        { headers: { Authorization: AUTHORIZATION } }
      );

      // Get Next Job
      // Note: WorkerController.getNextJob path is /workers/:workerId/jobs/next
      const nextRes = await axios.post(
        `${API_URL}/api/workers/${workerId}/jobs/next`,
        {},
        {
          headers: {
            Authorization: AUTHORIZATION,
            'x-worker-id': workerId,
          },
        }
      );

      const job = nextRes.data.data;
      if (job) {
        console.log(`[MockWorker] Claimed job ${job.id} (${job.type})`);

        // Ack
        // Endpoint: /api/jobs/:id/ack
        await axios.post(
          `${API_URL}/api/jobs/${job.id}/ack`,
          { workerId },
          { headers: { Authorization: AUTHORIZATION, 'x-worker-id': workerId } }
        );
        console.log(`[MockWorker] Acked job ${job.id}`);

        // Simulate work
        await new Promise((r) => setTimeout(r, 500));

        // Complete
        // Endpoint: /api/jobs/:id/complete
        await axios.post(
          `${API_URL}/api/jobs/${job.id}/complete`,
          {
            status: 'SUCCEEDED',
            result: { output: { simulated: true } },
            workerId,
          },
          { headers: { Authorization: AUTHORIZATION, 'x-worker-id': workerId } }
        );
        console.log(`[MockWorker] Completed job ${job.id}`);
        jobProcessed = true;
      } else {
        process.stdout.write('.');
        // Log response occasionally to debug
        if (i % 5 === 0) {
          console.log(`[MockWorker] No job. Payload: ${JSON.stringify(nextRes.data)}`);
        }
      }
    } catch (error: any) {
      console.error(`[MockWorker] Error in loop: ${error.message}`);
      if (error.response) {
        console.error('Response Data:', JSON.stringify(error.response.data));
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[MockWorker] Exiting. Processed job: ${jobProcessed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
