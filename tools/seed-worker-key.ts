// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();

async function main() {
  const WORKER_KEY = 'ak_worker_dev_0000000000000000';
  // Secret is only used for signing, stored encrypted in DB if needed, but for now we just need the Key ID to exist for lookup.
  // Schema has secretEnc etc, but old schema might have secretHash.
  // Let's see schema again.
  // model ApiKey { key string @unique, secretEnc ... }

  // We will create a key with ACTIVE status.

  const existing = await prisma.apiKey.findUnique({ where: { key: WORKER_KEY } });
  if (existing) {
    console.log('Key already exists.');
    return;
  }

  await prisma.apiKey.create({
    data: {
      key: WORKER_KEY,
      name: 'Dev Worker Key',
      status: 'ACTIVE',
      // Minimum required fields?
      // secretEnc is optional? schema says secretEnc String?
      // Let's provide minimal data.
    },
  });

  console.log('✅ Worker API Key seeded.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
