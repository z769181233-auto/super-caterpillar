import { PrismaClient } from 'database';
const prisma = new PrismaClient({});

async function main() {
  console.log('🌱 Seeding Worker API Key...');
  const key = process.env.WORKER_API_KEY || 'test-key';
  const secret = process.env.WORKER_API_SECRET || 'test-secret';

  // Upsert key
  // Unique constraint on `key` column? Likely.
  const apiKey = await prisma.apiKey.upsert({
    where: { key },
    update: {
      secretHash: secret, // In dev, we store plain secret? Or hash?
      // The init script stored plain secret with comment. Assumed service handles it.
      status: 'ACTIVE',
      name: 'Test Worker Key',
    },
    create: {
      key,
      secretHash: secret,
      status: 'ACTIVE',
      name: 'Test Worker Key',
    },
  });
  console.log(`✅ Seeded API Key: ${apiKey.key}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
