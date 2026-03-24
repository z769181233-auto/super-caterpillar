import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const prisma = new PrismaClient({});

async function main() {
  const projectId = 'scale_bench_1769794863695_0';
  const total = await prisma.shotJob.count({
    where: { projectId, type: 'SHOT_RENDER' },
  });
  const succeeded = await prisma.shotJob.count({
    where: { projectId, type: 'SHOT_RENDER', status: 'SUCCEEDED' },
  });
  const failed = await prisma.shotJob.count({
    where: { projectId, type: 'SHOT_RENDER', status: 'FAILED' },
  });
  const pending = await prisma.shotJob.count({
    where: { projectId, type: 'SHOT_RENDER', status: 'PENDING' },
  });

  console.log(`Project: ${projectId}`);
  console.log(`Total Shot Jobs: ${total}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pending: ${pending}`);

  await prisma.$disconnect();
}

main().catch(console.error);
