// apps/api/src/scripts/p1_2_billing_seed.ts
import { PrismaClient } from 'database';
import * as util from 'util';

const prisma = new PrismaClient({});

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
  await prisma.billingLedger.create({
    data: {
      tenantId: org.id,
      traceId: job.id,
      itemType: 'shot_render',
      itemId: job.id,
      chargeCode: 'ce03_visual_density',
      amount: 100, // 1 credit * 100
      status: 'POSTED',
      evidenceRef: 'seed',
    },
  });

  process.stdout.write(util.format(`PROJECT_ID=${project.id}`) + '\n');
  process.stdout.write(util.format(`ORG_ID=${org.id}`) + '\n');
  process.stdout.write(util.format(`TEST_JOB_ID=${job.id}`) + '\n');
  process.stdout.write(util.format(`PERIOD_START=${iso(periodStart)}`) + '\n');
  process.stdout.write(util.format(`PERIOD_END=${iso(periodEnd)}`) + '\n');
}

main()
  .catch((e) => {
    process.stderr.write(util.format(String(e?.stack ?? e)) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
