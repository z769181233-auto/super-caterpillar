import { PrismaClient } from 'database';
const prisma = new PrismaClient({});

console.error('DEBUG: Script Starting... DB=' + process.env.DATABASE_URL);

async function main() {
  console.error('--- Diagnosis ---');
  // 1. Check recent ShotJobs
  const jobs = await prisma.shotJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.error(`Found ${jobs.length} recent jobs.`);
  for (const j of jobs) {
    console.error(`Job: ${j.id} | Type: ${j.type} | Status: ${j.status} | Err: ${j.lastError}`);
    if (j.type === 'SHOT_RENDER') {
      console.error('   Payload Type:', typeof j.payload);
      console.error('   Payload:', JSON.stringify(j.payload));
    }
  }

  // 2. Check Assets
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`Found ${assets.length} recent assets.`);
  for (const a of assets) {
    console.log(`Asset: ${a.id} | Owner: ${a.ownerId} | Type: ${a.type} | Key: ${a.storageKey}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
