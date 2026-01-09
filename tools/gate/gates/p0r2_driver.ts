import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../apps/api/src/app.module';
import { CEDagOrchestratorService } from '../../../apps/api/src/ce-pipeline/ce-dag-orchestrator.service';
import { PrismaService } from '../../../apps/api/src/prisma/prisma.service';
import { JobService } from '../../../apps/api/src/job/job.service';
import { CEDagRunRequest } from '../../../apps/api/src/ce-pipeline/ce-dag.types';
import { Logger } from '@nestjs/common';
import { JobType } from 'database';

// Mock Input
const TEST_PROJECT_ID = 'test-project-p0r2';
const TEST_SHOT_ID = 'test-shot-p0r2';
const TEST_SCENE_ID = 'test-scene-p0r2';
const TEST_NOVEL_SOURCE_ID = 'test-novel-p0r2';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger('GateP0R2Driver');

  // --- 0. Data Seeding ---
  logger.log('Seeding test data...');

  // Clean up
  await prisma.shotJob.deleteMany({ where: { projectId: TEST_PROJECT_ID } });
  await prisma.asset.deleteMany({ where: { projectId: TEST_PROJECT_ID } });

  // Ensure Project Hierarchy
  const org = await prisma.organization.upsert({
    where: { id: 'org_gate_p0r2' },
    update: {},
    create: { id: 'org_gate_p0r2', name: 'Gate Org' },
  });

  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name: 'Gate P0R2 Project',
      organizationId: org.id,
      ownerId: 'gate_user',
    },
  });

  // Novel Source (required for CE06)
  await prisma.novelSource.upsert({
    where: { id: TEST_NOVEL_SOURCE_ID },
    update: {},
    create: {
      id: TEST_NOVEL_SOURCE_ID,
      projectId: project.id,
      rawText: 'A dark night in the cyberpunk city.',
      fileName: 'test.txt',
      fileSize: 100,
      importedAt: new Date(),
    },
  });

  // Scene & Shot
  const season = await prisma.season.create({
    data: { projectId: project.id, index: 1, title: 'S1' },
  });
  const episode = await prisma.episode.create({
    data: { seasonId: season.id, projectId: project.id, index: 1, name: 'E1' },
  });
  const scene = await prisma.scene.create({
    data: {
      id: TEST_SCENE_ID,
      episodeId: episode.id,
      index: 1,
      title: 'Scene 1',
      summary: 'A dark night.',
    },
  });

  const shot = await prisma.shot.create({
    data: {
      id: TEST_SHOT_ID,
      sceneId: scene.id,
      organizationId: org.id,
      index: 1,
      title: 'Shot 1',
      description: 'Cyberpunk city street',
      type: 'default',
      params: {},
      qualityScore: {},
    },
  });

  // --- 1. Run CE DAG ---
  logger.log('Triggering CE DAG...');

  const req: CEDagRunRequest = {
    projectId: TEST_PROJECT_ID,
    shotId: TEST_SHOT_ID,
    novelSourceId: TEST_NOVEL_SOURCE_ID,
    runId: 'run-gate-p0r2-' + Date.now(),
    traceId: 'trace-gate-p0r2-' + Date.now(),
  };

  try {
    const result = await dagService.runCEDag(req);

    console.log('__RESULT_START__');
    console.log(JSON.stringify(result, null, 2));
    console.log('__RESULT_END__');
  } catch (e) {
    console.error('DAG Execution Failed:', e);
    process.exit(1);
  }

  await app.close();
}

main().catch(console.error);
