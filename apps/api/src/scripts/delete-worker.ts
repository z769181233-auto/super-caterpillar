// apps/api/src/scripts/delete-worker.ts

import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  console.log('==============================');
  console.log(' 删除 Worker 相关记录');
  console.log('==============================');

  // 注意：模型名是 WorkerNode，所以这里是 workerNode
  await prisma.workerNode.deleteMany({});

  console.log('✅ 已删除 workerNode 表全部记录');
}

main()
  .catch((err) => {
    console.error('❌ 删除 Worker 记录失败:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });