import { ApiClient } from '../../apps/workers/src/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (override)
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const apiClient = new ApiClient(
  'http://localhost:3000',
  'dev-worker-key',
  'dev-worker-secret',
  'manual-trigger'
);

async function main() {
  const projectId = 'scale_bench_1769795112593_0';
  console.log(`Manually triggering VIDEO_RENDER for project: ${projectId}`);

  try {
    const job = await apiClient.createJob({
      jobType: 'VIDEO_RENDER',
      projectId: projectId,
      organizationId: 'org_scale_test',
      payload: {
        projectId: projectId,
      },
    });
    console.log(`Job Created: ${job.id}`);
  } catch (e) {
    console.error('Failed to create job:', e);
  }
}

main();
