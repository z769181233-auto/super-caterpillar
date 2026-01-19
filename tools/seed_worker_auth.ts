import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Worker Auth...');
  const key = process.env.WORKER_API_KEY || 'dev-worker-key';
  const secret = process.env.WORKER_API_SECRET || 'dev-worker-secret';

  // Ensure User/Org exist or use dummy
  // Ideally we attach to existing, but for gate we can just create

  // Upsert Key
  const result = await prisma.apiKey.upsert({
    where: { key },
    update: {
      secretHash: secret,
      status: 'ACTIVE',
    },
    create: {
      key,
      secretHash: secret,
      status: 'ACTIVE',
      name: 'Gate Worker Key',
      // We can leave owner fields empty if allowed, schema says optional
    },
  });

  console.log(`ApiKey Upserted: ${result.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
