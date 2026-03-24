import { PrismaClient } from 'database';
import { processCE11ShotGeneratorJob } from '../../../apps/workers/src/processors/ce11-shot-generator.processor';
import { ApiClient } from '../../../apps/workers/src/api-client';

async function main() {
  const prisma = new PrismaClient({});
  const jobId = process.argv[2];
  const workerId = process.argv[3];
  const job = await prisma.shotJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');

  const apiClient = new ApiClient(
    'http://localhost:3000',
    'dev-worker-key',
    'dev-worker-secret',
    workerId
  );

  console.log('[DEBUG] Acknowledging Job:', jobId, 'by worker:', workerId);
  const ackRes = await apiClient.ackJob(jobId, workerId);
  console.log('[DEBUG] Ack Response:', JSON.stringify(ackRes));

  const result = await processCE11ShotGeneratorJob({
    prisma,
    job: { ...job, status: 'RUNNING' } as any, // Simulate running state
    apiClient,
    logger: {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.log,
    },
  } as any);
  console.log('Result:', JSON.stringify(result));

  // Add small delay to ensure reportJobResult status propagation
  console.log('[DEBUG] Waiting for status sync...');
  await new Promise((r) => setTimeout(r, 2000));

  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
