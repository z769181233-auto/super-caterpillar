import { randomUUID } from 'crypto';
import * as util from 'util';

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

  process.stdout.write(util.format(`Triggering CE DAG E2E...`) + '\n');
  process.stdout.write(util.format(`RUN_ID=${runId}`) + '\n');
  process.stdout.write(util.format(`TRACE_ID=${traceId}`) + '\n');

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

  process.stdout.write(util.format(`CE06_JOB_ID=${result.ce06JobId}`) + '\n');
  process.stdout.write(util.format(`CE03_JOB_ID=${result.ce03JobId}`) + '\n');
  process.stdout.write(util.format(`CE04_JOB_ID=${result.ce04JobId}`) + '\n');
  process.stdout.write(util.format(`CE03_SCORE=${result.ce03Score}`) + '\n');
  process.stdout.write(util.format(`CE04_SCORE=${result.ce04Score}`) + '\n');
  process.stdout.write(
    util.format(`SHOT_RENDER_JOB_IDS=${(result.shotRenderJobIds || []).join(',')}`) + '\n'
  );
  process.stdout.write(util.format(`VIDEO_JOB_ID=${result.videoJobId || ''}`) + '\n');
  process.stdout.write(util.format(`VIDEO_KEY=${result.videoKey || ''}`) + '\n');

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(util.format(err.message) + '\n');
  process.exit(1);
});
