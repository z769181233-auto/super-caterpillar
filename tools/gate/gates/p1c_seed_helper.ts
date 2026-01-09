import { PrismaClient } from '../../../packages/database/src/generated/prisma';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const action = args.find((a) => a.startsWith('--action='))?.split('=')[1] || 'default';
  const orgId = args.find((a) => a.startsWith('--orgId='))?.split('=')[1] || 'p1c-org';
  const projectId = 'p1c-test-proj';

  if (action === 'seed_ledgers') {
    // 1. Setup Org/Project if not exists
    const user = await prisma.user.upsert({
      where: { id: 'gate-tester-id' },
      create: { id: 'gate-tester-id', email: 'gate-tester@test.local', passwordHash: 'unused' },
      update: {},
    });

    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: 'P1-C Org', ownerId: user.id, credits: 1000 },
      update: { credits: 1000, ownerId: user.id },
    });

    await prisma.project.upsert({
      where: { id: projectId },
      create: { id: projectId, name: 'P1-C Project', organizationId: orgId, ownerId: user.id },
      update: { organizationId: orgId, ownerId: user.id },
    });

    // Clean old ledgers/events for this project to ensure clean reconcile
    await prisma.billingEvent.deleteMany({ where: { projectId } });
    await prisma.costLedger.deleteMany({ where: { projectId } });

    // 2. Create CostLedgers
    const ledgerCount = 5;
    for (let i = 1; i <= ledgerCount; i++) {
      const id = randomUUID();
      await prisma.costLedger.create({
        data: {
          id,
          projectId,
          orgId,
          jobId: `job-c-${i}-${Date.now()}`,
          jobType: 'SHOT_RENDER',
          totalCredits: 10 * i, // 10, 20, 30, 40, 50 = Sum 150
          billingStatus: 'PENDING',
        },
      });
    }
    console.log(
      `✅ Seeded ${ledgerCount} PENDING CostLedgers for project ${projectId}. Total Credits to Settle: 150`
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
