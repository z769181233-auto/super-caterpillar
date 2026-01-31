import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pendingCount = await prisma.shotJob.count({
    where: { status: 'PENDING' },
  });
  console.log(`Pending jobs count: ${pendingCount}`);

  const types = await prisma.shotJob.groupBy({
    by: ['type'],
    where: { status: 'PENDING' },
    _count: { type: true },
  });
  console.log('Pending jobs by type:', types);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
