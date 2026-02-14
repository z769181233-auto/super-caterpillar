import { PrismaClient } from './packages/database/src/generated/prisma';
const prisma = new PrismaClient();
async function main() {
  const jobs = await prisma.shotJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
}
main();
