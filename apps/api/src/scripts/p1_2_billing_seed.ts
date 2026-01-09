// apps/api/src/scripts/p1_2_billing_seed.ts
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

function iso(d: Date) {
  return d.toISOString();
}

async function main() {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 10 * 60 * 1000);
  const periodEnd = new Date(now.getTime() + 10 * 60 * 1000);

  // 1) 组织:优先复用最新 organization(避免必填字段不一致)
  const org =
    (await prisma.organization.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })) ??
    (await prisma.organization.create({
      data: {
        name: `p1_2_org_${Date.now()}`,
        credits: 100, // 确保不阻塞
      } as any,
      select: { id: true },
    }));

  // 2) 项目:优先复用最新 project
  const project =
    (await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })) ??
    (await prisma.project.create({
      data: {
        name: `p1_2_billing_${Date.now()}`,
        organizationId: org.id,
      } as any,
      select: { id: true },
    }));

  // 3) 创建 job(模拟重试:attempts=3)
  const job = await prisma.shotJob.create({
    data: {
      projectId: project.id,
      status: 'SUCCEEDED',
      attempts: 3,
      jobType: 'CE03_VISUAL_DENSITY' as any,
      payload: {} as any,
      traceId: `p1_2_billing_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    } as any,
    select: { id: true },
  });

  // 4) 创建 ledger(只 1 条,保证不重复)
  await prisma.costLedger.create({
    data: {
      projectId: project.id,
      jobId: job.id,
      jobType: 'CE03_VISUAL_DENSITY' as any,
      cost: 1,
      createdAt: now,
      metadata: { seed: true },
    } as any,
  });

  console.log(`PROJECT_ID=${project.id}`);
  console.log(`ORG_ID=${org.id}`);
  console.log(`TEST_JOB_ID=${job.id}`);
  console.log(`PERIOD_START=${iso(periodStart)}`);
  console.log(`PERIOD_END=${iso(periodEnd)}`);
}

main()
  .catch((e) => {
    console.error(String(e?.stack ?? e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
