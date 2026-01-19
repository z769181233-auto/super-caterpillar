// @ts-ignore
import { PrismaClient } from '../../../packages/database/src/index';

const prisma = new PrismaClient();
const TEST_STORAGE_KEY = process.env.TEST_STORAGE_KEY;

if (!TEST_STORAGE_KEY) {
  console.error('Error: TEST_STORAGE_KEY env var is missing.');
  process.exit(1);
}

async function main() {
  console.log(`Ensuring Gate 3 Data for key: ${TEST_STORAGE_KEY}`);

  // Use AUTH_EMAIL to align with the token used in run_launch_gates.sh
  const email = process.env.AUTH_EMAIL || 'gate_bot@example.com';
  console.log(`Using user email: ${email}`);

  // 1. Ensure User
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: 'placeholder_hash',
    },
  });

  // 2. Ensure Org (Handle unique slug) - Force Update Ownership
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: 'gate-org' },
  });

  let org;
  if (existingOrg) {
    org = await prisma.organization.update({
      where: { id: existingOrg.id },
      data: { ownerId: user.id },
    });
    console.log(`Org updated ownership: ${org.id}`);
  } else {
    org = await prisma.organization.upsert({
      where: { id: 'gate-org' },
      update: { ownerId: user.id },
      create: {
        id: 'gate-org',
        name: 'Gate Org',
        slug: 'gate-org',
        ownerId: user.id,
      },
    });
    console.log(`Org ensured via upset: ${org.id}`);
  }

  // 3. Ensure Project - Force Update Ownership
  const project = await prisma.project.upsert({
    where: { id: 'gate-project-3' },
    update: {
      ownerId: user.id,
      organizationId: org.id,
    },
    create: {
      id: 'gate-project-3',
      name: 'Gate 3 Probe Project',
      status: 'in_progress' as any,
      organizationId: org.id,
      ownerId: user.id,
    },
  });

  // 4. Ensure Asset - Handle @@unique([ownerType, ownerId, type])
  // We first check if an asset exists for this owner/type regardless of storage key.
  const existingAsset = await prisma.asset.findFirst({
    where: {
      ownerType: 'SHOT' as any,
      ownerId: user.id,
      type: 'VIDEO' as any,
    },
  });

  if (existingAsset) {
    await prisma.asset.update({
      where: { id: existingAsset.id },
      data: {
        storageKey: TEST_STORAGE_KEY,
        status: 'PUBLISHED' as any,
        projectId: project.id,
        // ownerId is already correct
      },
    });
    console.log(`Asset updated (reused): ${existingAsset.id}`);
  } else {
    const asset = await prisma.asset.create({
      data: {
        storageKey: TEST_STORAGE_KEY,
        type: 'VIDEO' as any,
        status: 'PUBLISHED' as any,
        ownerType: 'SHOT' as any,
        ownerId: user.id,
        projectId: project.id,
      },
    });
    console.log(`Asset created: ${asset.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
