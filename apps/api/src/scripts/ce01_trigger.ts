import { PrismaClient } from 'database';
import { randomUUID } from 'crypto';
import * as util from 'util';

const prisma = new PrismaClient({});

async function main() {
  try {
    // === Worker UPSERT Regression Test ===
    process.stdout.write(util.format('[Regression] Testing Worker UPSERT...') + '\n');
    const workerId = 'reg-test-worker';
    // 1. First Register
    await prisma.workerNode.upsert({
      where: { workerId },
      create: {
        workerId,
        name: 'v1',
        status: 'online',
        lastHeartbeat: new Date(),
        capabilities: { supportedJobTypes: ['A'] } as any,
      },
      update: {
        name: 'v1',
        capabilities: { supportedJobTypes: ['A'] } as any,
        updatedAt: new Date(),
      },
    });
    // 2. Second Register (Update)
    await prisma.workerNode.upsert({
      where: { workerId },
      create: {
        workerId,
        name: 'v2',
        status: 'online',
        lastHeartbeat: new Date(),
        capabilities: { supportedJobTypes: ['B'] } as any,
      },
      update: {
        name: 'v2',
        capabilities: { supportedJobTypes: ['B'] } as any,
        updatedAt: new Date(),
      },
    });
    // 3. Verify
    const w = await prisma.workerNode.findUnique({ where: { workerId } });
    const caps = w?.capabilities as any;
    if (!w || !caps?.supportedJobTypes?.includes('B') || caps?.supportedJobTypes?.includes('A')) {
      process.stderr.write(
        util.format(
          "FATAL: Worker UPSERT regression failed. Expected ['B'], got",
          caps?.supportedJobTypes
        ) + '\n'
      );
      process.stderr.write(util.format('Worker state:', w) + '\n');
      process.exit(1);
    }
    process.stdout.write(util.format('[Regression] Worker UPSERT Passed.') + '\n');
    // =====================================

    // 1. Find a valid context (Project -> Season -> Episode -> Scene -> Shot)
    let project = await prisma.project.findFirst();
    if (!project) {
      // Create dummy
      project = await prisma.project.create({
        data: {
          id: randomUUID(),
          name: 'Gate Test Project',
          organizationId: 'test-org',
          ownerId: 'test-user',
        },
      });
    }

    const shot = await prisma.shot.findFirst({
      include: { scene: { include: { episode: true } } },
    });

    let shotId = shot?.id;
    let sceneId = shot?.sceneId;
    let episodeId = shot?.scene.episodeId;
    let projectId = project.id;

    // Create dummy hierarchy if missing
    if (!shot) {
      process.stdout.write(util.format('Creating dummy hierarchy...') + '\n');
      // This might fail if constraints exist, but assuming basic creation works
      // If strict constraints, we might need more data.
      // Try finding any shot or just failing if empty DB.
      // Ideally we assume DB seeded.
      // If not, let's try to create one.
      // But let's assume one exists or we fail.
    }

    if (!shotId) {
      process.stderr.write(util.format('No shots found. Cannot create CE01 job.') + '\n');
      process.exit(1);
    }

    const jobId = randomUUID();
    const payload = {
      projectId: projectId,
      characterName: 'GateTestChar',
      characterDescription: 'A character created by the gate script',
      traceId: `gate-${Date.now()}`,
    };

    process.stdout.write(util.format(`Triggering CE01 Job with ID: ${jobId}`) + '\n');

    const job = await prisma.shotJob.create({
      data: {
        id: jobId,
        organizationId: project.organizationId,
        projectId: projectId,
        episodeId: episodeId!,
        sceneId: sceneId!,
        shotId: shotId!,
        type: 'CE01_REFERENCE_SHEET',
        status: 'PENDING',
        payload: payload,
        workerId: null,
        priority: 100,
        maxRetry: 3,
        attempts: 0,
        traceId: payload.traceId,
      },
    });

    process.stdout.write(util.format(`JOB_ID=${job.id}`) + '\n');
  } catch (e) {
    process.stderr.write(util.format(e) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
