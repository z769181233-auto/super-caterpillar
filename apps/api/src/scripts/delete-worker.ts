// apps/api/src/scripts/delete-worker.ts

import { PrismaClient } from 'database';
import * as util from 'util';

const prisma = new PrismaClient();

async function main() {
  process.stdout.write(util.format('==============================') + '\n');
  process.stdout.write(util.format(' 删除 Worker 相关记录') + '\n');
  process.stdout.write(util.format('==============================') + '\n');

  // 注意：模型名是 WorkerNode，所以这里是 workerNode
  await prisma.workerNode.deleteMany({});

  process.stdout.write(util.format('✅ 已删除 workerNode 表全部记录') + '\n');
}

main()
  .catch((err) => {
    process.stderr.write(util.format('❌ 删除 Worker 记录失败:', err) + '\n');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
