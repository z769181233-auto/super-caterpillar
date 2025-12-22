import { PrismaClient } from 'database';

/**
 * 将所有 NOVEL_ANALYSIS Job 重置为 PENDING 并清空 workerId
 */
async function main() {
  const prisma = new PrismaClient();

  const result = await prisma.shotJob.updateMany({
    where: { type: 'NOVEL_ANALYSIS' as any },
    data: {
      status: 'PENDING' as any,
      workerId: null,
      attempts: 0,
      retryCount: 0,
      lastError: null,
    },
  });

  console.log('reset count:', result.count);
  await prisma.$disconnect();
  // ✅ 成功路径显式退出
  if (!process.exitCode) {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

