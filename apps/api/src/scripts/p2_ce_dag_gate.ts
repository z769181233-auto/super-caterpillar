import { randomUUID } from 'crypto';

/**
 * P2-3 CE DAG Gate Script
 * Triggers /api/ce-dag/run and outputs job IDs for shell gate to parse
 */

async function main() {
  const API_BASE = process.env.API_BASE || 'http://localhost:3001';

  const projectId = process.env.PROJ_ID;
  const novelSourceId = process.env.SOURCE_ID;
  const shotId = process.env.SHOT_ID;

  if (!projectId || !novelSourceId || !shotId) {
    throw new Error('Missing required env: PROJ_ID, SOURCE_ID, SHOT_ID');
  }

  const runId = randomUUID();
  const traceId = `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const payload = {
    projectId,
    novelSourceId,
    shotId,
    runId,
    traceId,
  };

  console.log(`Triggering CE DAG E2E...`);
  console.log(`RUN_ID=${runId}`);
  console.log(`TRACE_ID=${traceId}`);

  const response = await fetch(`${API_BASE}/api/ce-dag/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  console.log(`CE06_JOB_ID=${result.ce06JobId}`);
  console.log(`CE03_JOB_ID=${result.ce03JobId}`);
  console.log(`CE04_JOB_ID=${result.ce04JobId}`);
  console.log(`CE03_SCORE=${result.ce03Score}`);
  console.log(`CE04_SCORE=${result.ce04Score}`);
  console.log(`SHOT_RENDER_JOB_IDS=${(result.shotRenderJobIds || []).join(',')}`);
  console.log(`VIDEO_JOB_ID=${result.videoJobId || ''}`);
  console.log(`VIDEO_KEY=${result.videoKey || ''}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
