import { PrismaClient } from '../packages/database/src/generated/prisma';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding minimal data for gate...');

  const userId = randomUUID();
  const orgId = randomUUID();
  const projectId = randomUUID();
  const seasonId = randomUUID();
  const episodeId = randomUUID();
  const sceneId = randomUUID();
  const shotId = randomUUID();

  await prisma.user.create({
    data: {
      id: userId,
      email: `gate-user-${Date.now()}@example.com`,
      passwordHash: 'dummy',
    },
  });

  await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Gate Org',
      ownerId: userId,
    },
  });

  await prisma.project.create({
    data: {
      id: projectId,
      name: 'Gate Project',
      ownerId: userId,
      organizationId: orgId,
    },
  });

  await prisma.season.create({
    data: {
      id: seasonId,
      projectId,
      index: 1,
      title: 'S1',
    },
  });

  await prisma.episode.create({
    data: {
      id: episodeId,
      seasonId,
      projectId,
      index: 1,
      name: 'E1',
    },
  });

  await prisma.scene.create({
    data: {
      id: sceneId,
      episodeId,
      projectId,
      index: 1,
      title: 'S1',
    },
  });

  await prisma.shot.create({
    data: {
      id: shotId,
      sceneId,
      index: 1,
      type: 'GENERIC',
    },
  });

  console.log('Minimal seed completed.');
  console.log(`SHOT_ID=${shotId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
