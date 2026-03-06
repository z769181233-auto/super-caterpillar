import { PrismaClient } from '@prisma/client';

type AssertInput = {
  projectIdA?: string;
  projectIdB?: string;
  pipelineRunIdA?: string;
  pipelineRunIdB?: string;
};

const prisma = new PrismaClient({});

function must(cond: any, msg: string) {
  if (!cond) {
    console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
    process.exit(2);
  }
}

async function main() {
  const input: AssertInput = JSON.parse(process.argv[2] || '{}');

  // 1) VIDEO_RENDER 幂等（按 projectId 断言）
  if (input.projectIdA) {
    const c = await prisma.shotJob.count({
      where: { projectId: input.projectIdA, type: 'VIDEO_RENDER' },
    });
    must(c === 1, `VIDEO_RENDER idempotency failed for projectIdA=${input.projectIdA}, count=${c}`);
  }
  if (input.projectIdB) {
    const c = await prisma.shotJob.count({
      where: { projectId: input.projectIdB, type: 'VIDEO_RENDER' },
    });
    must(c === 1, `VIDEO_RENDER idempotency failed for projectIdB=${input.projectIdB}, count=${c}`);
  }

  // 2) workerId 审计：SUCCEEDED 不能丢 workerId
  const nullWorker = await prisma.shotJob.count({
    where: { status: 'SUCCEEDED', workerId: null },
  });
  must(nullWorker === 0, `workerId audit failed: SUCCEEDED jobs with workerId=null: ${nullWorker}`);

  // 3) 并发正确性：DISPATCHED/RUNNING 必须有 workerId
  const bad = await prisma.shotJob.count({
    where: {
      status: { in: ['DISPATCHED', 'RUNNING'] },
      workerId: null,
    },
  });
  must(bad === 0, `dispatch correctness failed: DISPATCHED/RUNNING jobs without workerId: ${bad}`);

  // 4) 输出统计，供 evidence 存档
  const group = await prisma.shotJob.groupBy({
    by: ['type', 'status'],
    _count: true,
  });

  console.log(JSON.stringify({ ok: true, group }, null, 2));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
    process.exit(3);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
