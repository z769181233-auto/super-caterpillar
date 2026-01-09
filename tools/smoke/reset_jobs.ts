import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting jobs to PENDING...');
  const { count } = await prisma.shotJob.updateMany({
    where: {
      status: 'RUNNING',
      workerId: { not: null },
    },
    data: {
      status: 'PENDING',
      workerId: null,
      attempts: 0, // Reset attempts so it's picked up
    },
  });

  console.log(`Reset ${count} jobs to PENDING.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
