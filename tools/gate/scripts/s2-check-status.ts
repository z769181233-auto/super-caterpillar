import { PrismaClient } from 'database';

const prisma = new PrismaClient();
const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: tsx tools/gate/scripts/s2-check-status.ts <JOB_ID>');
  process.exit(1);
}

async function main() {
  const job = await prisma.shotJob.findUnique({
    where: { id: jobId },
    select: { status: true, workerId: true },
  });

  if (!job) {
    console.log('NOT_FOUND');
  } else {
    // Output format: STATUS|WORKER_ID
    console.log(`${job.status}|${job.workerId || 'null'}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
