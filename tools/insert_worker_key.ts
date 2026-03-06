import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});

async function main() {
  console.log('[Seed] 开始插入 Worker API Key...');

  const result = await prisma.apiKey.upsert({
    where: { key: 'dev-worker-key' },
    update: {
      secretHash: 'dev-worker-secret',
      status: 'ACTIVE',
    },
    create: {
      key: 'dev-worker-key',
      secretHash: 'dev-worker-secret',
      status: 'ACTIVE',
      name: 'Worker Key for Stage 4 Gate',
    },
  });

  console.log('[Seed] API Key 插入成功:', result.id, result.key);

  const verify = await prisma.apiKey.findUnique({
    where: { key: 'dev-worker-key' },
    select: { id: true, key: true, secretHash: true, status: true },
  });

  console.log('[Seed] 验证结果:', verify);
}

main()
  .catch((e) => {
    console.error('[Seed] 错误:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
