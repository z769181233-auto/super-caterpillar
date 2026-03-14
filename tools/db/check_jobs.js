const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({});

async function main() {
  try {
    const pendingCount = await prisma.shotJob.count({
      where: { status: 'PENDING' },
    });
    console.log(`Pending jobs count: ${pendingCount}`);

    const types = await prisma.shotJob.groupBy({
      by: ['type'],
      where: { status: 'PENDING' },
      _count: { type: true },
    });
    console.log('Pending jobs by type:', JSON.stringify(types, null, 2));

    const total = await prisma.shotJob.count();
    console.log(`Total jobs: ${total}`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
