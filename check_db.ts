import { PrismaClient } from './packages/database';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.shotJob.count();
  console.log('ShotJob count:', count);
  const latest = await prisma.shotJob.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest job:', latest?.type, latest?.status, latest?.projectId);
}
main();
