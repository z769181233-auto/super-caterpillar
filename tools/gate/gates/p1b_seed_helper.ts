import { PrismaClient } from '../../../packages/database/src/generated/prisma';

const prisma = new PrismaClient({});

async function main() {
  const args = process.argv.slice(2);
  const actionArg = args.find((a) => a.startsWith('--action='));
  const action = actionArg ? actionArg.split('=')[1] : 'default';
  const orgId = args.find((a) => a.startsWith('--orgId='))?.split('=')[1] || 'p1b-org';

  if (action === 'setup_test_project') {
    const user = await prisma.user.upsert({
      where: { id: 'gate-tester-id' },
      create: {
        id: 'gate-tester-id',
        email: 'gate-tester@test.local',
        passwordHash: 'unused',
      },
      update: {},
    });

    // Ensure Org owner is gate-tester-id (Fix for 403 Forbidden)
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: { ownerId: user.id },
      });
      console.log(`✅ Organization ${orgId} owner updated to ${user.id}`);
    } catch (e) {
      console.warn(`Warn: Could not update org ${orgId} owner:`, e);
    }

    await prisma.project.upsert({
      where: { id: 'p1b-test-proj' },
      create: {
        id: 'p1b-test-proj',
        name: 'P1-B Test Project',
        organizationId: orgId,
        ownerId: user.id,
      },
      update: {
        organizationId: orgId,
        ownerId: user.id,
      },
    });

    await prisma.season.upsert({
      where: { id: 'p1b-test-season' },
      create: { id: 'p1b-test-season', title: 'S1', projectId: 'p1b-test-proj', index: 1 },
      update: {},
    });
    await prisma.episode.upsert({
      where: { id: 'p1b-test-ep' },
      create: { id: 'p1b-test-ep', name: 'E1', seasonId: 'p1b-test-season', index: 1 },
      update: {},
    });
    await prisma.scene.upsert({
      where: { id: 'p1b-test-scene' },
      create: { id: 'p1b-test-scene', title: 'Scene 1', episodeId: 'p1b-test-ep', index: 1 },
      update: {},
    });
    await prisma.shot.upsert({
      where: { id: 'p1b-test-shot' },
      create: {
        id: 'p1b-test-shot',
        sceneId: 'p1b-test-scene',
        index: 1,
        title: 'Test Shot',
        type: 'SHOT_RENDER',
      },
      update: {},
    });

    console.log(`✅ P1-B Seed Helper: Project p1b-test-proj owned by ${user.id} set up.`);
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
