import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (override)
const envLocalPath = path.join(process.cwd(), '.env.local');
// We try loading .env.local, then .env
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });
console.log('Checking DB URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.shotJob.findMany({
    where: { id: 'd16a776f-8d2b-4642-a8fb-3ca4d8f2ff35' },
    include: {
      engineBinding: true,
    },
  });

  jobs.forEach((job) => {
    console.log(
      `Job: ${job.id} | Status: ${job.status} | Worker: ${job.workerId} | Result: ${JSON.stringify(job.result)}`
    );
  });

  if (jobs.length === 0) {
    console.log('No VIDEO_RENDER jobs found for this project.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
