import { PrismaClient } from 'database';
import { randomUUID } from 'crypto';
import * as util from 'util';

async function main() {
  const count = parseInt(
    process.argv.find((arg) => arg.startsWith('--count='))?.split('=')[1] || '10',
    10
  );
  const prisma = new PrismaClient({});

  process.stdout.write(util.format(`[StressTrigger] Injecting ${count} PENDING jobs...`) + '\n');

  // 1. 简化的层级创建逻辑
  let org = await prisma.organization.findFirst();
  if (!org) {
    const user = await prisma.user.create({
      data: { email: `stress_${randomUUID().substring(0, 8)}@example.com`, passwordHash: 'dummy' },
    });
    org = await prisma.organization.create({ data: { name: 'Stress Org', ownerId: user.id } });
  }

  let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
  if (!project) {
    project = await prisma.project.create({
      data: { name: 'Stress Project', organizationId: org.id, ownerId: org.ownerId },
    });
  }

  let season = await prisma.season.findFirst({ where: { projectId: project.id } });
  if (!season) {
    season = await prisma.season.create({ data: { title: 'S1', index: 1, projectId: project.id } });
  }

  let episode = await prisma.episode.findFirst({ where: { seasonId: season.id } });
  if (!episode) {
    episode = await prisma.episode.create({
      data: { name: 'E1', index: 1, seasonId: season.id, projectId: project.id },
    });
  }

  let scene = await prisma.scene.findFirst({ where: { episodeId: episode.id } });
  if (!scene) {
    scene = await prisma.scene.create({
      data: { title: 'Scene 1', index: 1, episodeId: episode.id, projectId: project.id },
    });
  }

  let shot = await prisma.shot.findFirst({ where: { sceneId: scene.id } });
  if (!shot) {
    shot = await prisma.shot.create({
      data: { title: 'Shot 1', index: 1, type: 'stress', sceneId: scene.id },
    });
  }

  // 2. 批量注入 Job
  for (let i = 0; i < count; i++) {
    await prisma.shotJob.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,
        type: 'SHOT_RENDER',
        status: 'PENDING',
        payload: {
          stress_test: true,
          traceId: `stress_${randomUUID()}`,
        },
      },
    });
  }

  process.stdout.write(
    util.format(`[StressTrigger] ✅ Successfully injected ${count} jobs.`) + '\n'
  );
  await prisma.$disconnect();
}

main().catch(console.error);
