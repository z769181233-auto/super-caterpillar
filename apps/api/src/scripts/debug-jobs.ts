import { PrismaClient } from 'database';

/**
 * 调试脚本：打印最近 20 条 NOVEL_ANALYSIS Job
 */
async function main() {
  const prisma = new PrismaClient();
  const jobs = await prisma.shotJob.findMany({
    where: {
      type: 'NOVEL_ANALYSIS' as any,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(
    jobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      workerId: j.workerId,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }))
  );

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
