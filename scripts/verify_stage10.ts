import { PrismaClient, UserRole } from '../packages/database/src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Stage 10 Verification (Refined) ---');

  // 1. Setup Test Data
  console.log('1. Setting up Test Data...');
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found, creating test user...');
    try {
      user = await prisma.user.create({
        data: {
          email: `test-user-${Date.now()}@example.com`,
          passwordHash: 'dummy',
          role: UserRole.ADMIN,
        },
      });
    } catch (e) {
      console.error('User creation failed:', e);
      // Fallback if concurrency
      user = await prisma.user.findFirst();
    }
  }
  if (!user) throw new Error('Failed to setup user');

  // Create Test Org
  const orgSlug = `test-org-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: 'Test Org Stage 10',
      ownerId: user.id,
      slug: orgSlug,
      credits: 100,
    },
  });
  console.log(`Created Org: ${org.id} with 100 credits`);

  // 2. Billing Concurrency Test (With Audit)
  console.log('2. Testing Billing Concurrency & Audit...');
  const iterations = 10;
  const cost = 10;

  const promises = [];
  for (let i = 0; i < iterations; i++) {
    promises.push(
      prisma.$transaction(async (tx) => {
        // Atomic Decrement Logic
        const result = await tx.organization.updateMany({
          where: {
            id: org.id,
            credits: { gte: cost },
          },
          data: {
            credits: { decrement: cost },
          },
        });

        if (result.count === 0) throw new Error('Insufficient');

        // Ledger
        await tx.billingEvent.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            eventType: 'pay_as_you_go',
            amount: -cost,
            creditsConsumed: cost,
            totalCost: cost,
            computeSecondsUsed: 0,
            gpuCost: 0,
            modelCost: 0,
            storageCost: 0,
            billingStatus: 'completed',
            metadata: { iteration: i },
          },
        });

        // Audit Log (Atomic)
        await (tx as any).auditLog.create({
          data: {
            userId: user.id,
            orgId: org.id,
            action: 'BILLING_CONSUME_TEST',
            resourceType: 'job',
            resourceId: `trace-${i}`,
            timestamp: new Date(),
            payload: {},
          },
        });
      })
    );
  }

  const results = await Promise.allSettled(promises);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Promise ${i} failed:`, r.reason);
  });
  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`Concurrency Results: ${successCount}/${iterations} succeeded`);

  const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
  console.log(`Final Credits: ${updatedOrg?.credits} (Expected: 0)`);

  if (updatedOrg?.credits !== 0) {
    console.error('FAILED: Credits mismatch');
    process.exit(1);
  }

  // Verify Audit Log Count
  const auditCount = await (prisma as any).auditLog.count({
    where: { orgId: org.id, action: 'BILLING_CONSUME_TEST' },
  });
  console.log(`Audit Logs Created: ${auditCount} (Expected: ${successCount})`);

  if (auditCount !== successCount) {
    console.error('FAILED: Audit Log mismatch (Not atomic?)');
    process.exit(1);
  }

  // 3. Asset Idempotency Test
  console.log('3. Testing Asset Idempotency...');

  // Create Hierarchy: Project -> Season -> Episode -> Scene -> Shot
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      ownerId: user.id,
      organizationId: org.id,
      description: 'Test',
    },
  });

  const season = await prisma.season.create({
    data: {
      projectId: project.id,
      title: 'Season 1',
      index: 1,
    },
  });

  const episode = await prisma.episode.create({
    data: {
      seasonId: season.id,
      projectId: project.id,
      name: 'Ep1',
      index: 1,
    },
  });

  const scene = await prisma.scene.create({
    data: {
      episodeId: episode.id,
      title: 'Sc1',
      index: 1,
    },
  });

  const shot = await prisma.shot.create({
    data: {
      sceneId: scene.id,
      organizationId: org.id,
      title: 'Shot1',
      index: 1,
      type: 'BASIC',
    },
  });

  console.log(`Created Shot: ${shot.id}`);

  // Upsert 1
  await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: 'SHOT',
        ownerId: shot.id,
        type: 'VIDEO',
      },
    },
    create: {
      projectId: project.id,
      ownerType: 'SHOT',
      ownerId: shot.id,
      type: 'VIDEO',
      status: 'GENERATED',
      storageKey: 'key1',
    },
    update: { storageKey: 'key1' },
  });
  console.log('Upsert 1 done (key1).');

  // Upsert 2 (Retry with same key)
  await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: 'SHOT',
        ownerId: shot.id,
        type: 'VIDEO',
      },
    },
    create: {
      projectId: project.id,
      ownerType: 'SHOT',
      ownerId: shot.id,
      type: 'VIDEO',
      status: 'GENERATED',
      storageKey: 'key1',
    },
    update: { storageKey: 'key1' },
  });
  console.log('Upsert 2 done (key1 retry).');

  // Upsert 3 (New key - overwrite)
  await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: 'SHOT',
        ownerId: shot.id,
        type: 'VIDEO',
      },
    },
    create: {
      projectId: project.id,
      ownerType: 'SHOT',
      ownerId: shot.id,
      type: 'VIDEO',
      status: 'GENERATED',
      storageKey: 'key2',
    },
    update: { storageKey: 'key2' },
  });
  console.log('Upsert 3 done (key2 overwrite).');

  // Verify count
  const assetCount = await prisma.asset.count({
    where: { ownerId: shot.id, type: 'VIDEO' },
  });
  console.log(`Asset Count: ${assetCount} (Expected: 1)`);

  const asset = await prisma.asset.findFirst({
    where: { ownerId: shot.id, type: 'VIDEO' },
  });
  console.log(`Current Asset Key: ${asset?.storageKey} (Expected: key2)`);

  if (assetCount !== 1 || asset?.storageKey !== 'key2') {
    console.error('FAILED: Asset Idempotency');
    process.exit(1);
  }

  console.log('--- ALL VERIFICATIONS PASSED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
