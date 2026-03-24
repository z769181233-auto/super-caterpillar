import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function main() {
  const job = await prisma.shotJob.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('Latest Job:', JSON.stringify(job, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
