import { PrismaClient } from 'database';

async function main() {
  const prisma = new PrismaClient({});
  console.log('Flushing job queue...');
  const res = await prisma.shotJob.updateMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] },
    },
    data: {
      status: 'FAILED',
      lastError: 'Cancelled by P24-0 flush script',
    },
  });
  console.log(`Flushed ${res.count} jobs.`);
  await prisma.$disconnect();
}

main().catch(console.error);
