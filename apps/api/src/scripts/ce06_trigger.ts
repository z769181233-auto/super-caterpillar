import { PrismaClient } from 'database';
import { randomUUID } from 'crypto';
import * as util from 'util';

const prisma = new PrismaClient({});

async function main() {
  try {
    process.stdout.write(util.format('Finding organization...') + '\n');
    let org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization found in database. Please seed or create one first.');
    }

    process.stdout.write(util.format('Finding user...') + '\n');
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found in database.');
    }

    process.stdout.write(util.format('Creating/Finding test project for CE06...') + '\n');
    let project = await prisma.project.findFirst({ where: { name: 'CE06 Gate Test' } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          id: randomUUID(),
          name: 'CE06 Gate Test',
          organizationId: org.id,
          ownerId: user.id,
        },
      });
    }

    process.stdout.write(util.format('Preparing novel source...') + '\n');
    const novelSource = await prisma.novelSource.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        rawText: '第一卷：测试\n第一章：实验\n这是实验场景。',
      },
    });

    process.stdout.write(util.format('Finding anchor shot for foreign keys...') + '\n');
    const anchorShot = await prisma.shot.findFirst({
      include: { scene: { include: { episode: true } } },
    });
    if (!anchorShot) {
      throw new Error('No shots found in database to use as anchor.');
    }

    const jobId = randomUUID();
    const traceId = `trace-ce06-gate-${Date.now()}`;

    process.stdout.write(util.format(`Triggering NOVEL_ANALYSIS Job: ${jobId}`) + '\n');

    const job = await prisma.shotJob.create({
      // ... (keep existing data)
      data: {
        id: jobId,
        organizationId: project.organizationId,
        projectId: project.id,
        episodeId: anchorShot.scene.episodeId,
        sceneId: anchorShot.sceneId,
        shotId: anchorShot.id,
        type: 'CE06_NOVEL_PARSING',
        status: 'PENDING',
        payload: {
          projectId: project.id,
          novelSourceId: novelSource.id,
        },
        workerId: null,
        priority: 100,
        maxRetry: 3,
        attempts: 0,
        traceId: traceId,
      },
    });

    process.stdout.write(util.format('Creating job engine binding...') + '\n');
    await prisma.jobEngineBinding.create({
      data: {
        id: randomUUID(),
        job: { connect: { id: job.id } },
        engine: { connect: { engineKey: 'ce06_novel_parsing' } },
        engineKey: 'ce06_novel_parsing',
        status: 'BOUND',
      },
    } as any);

    process.stdout.write(util.format(`JOB_ID=${job.id}`) + '\n');
    process.stdout.write(util.format(`PROJECT_ID=${project.id}`) + '\n');
  } catch (e) {
    process.stderr.write(util.format(e) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
