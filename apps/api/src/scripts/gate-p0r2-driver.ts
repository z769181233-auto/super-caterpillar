import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CEDagOrchestratorService } from '../ce-pipeline/ce-dag-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CEDagRunRequest } from '../ce-pipeline/ce-dag.types';
import { Logger } from '@nestjs/common';
import { JobType } from 'database';

// Mock Input
const TEST_PROJECT_ID = `test-project-p0r2-${Date.now()}`;
const TEST_NOVEL_SOURCE_ID = `test-novel-p0r2-${Date.now()}`;
const TEST_SHOT_ID = `test-shot-p0r2-${Date.now()}`;
const TEST_SCENE_ID = `test-scene-p0r2-${Date.now()}`;

async function main() {
  console.log('--- DRIVER: Creating App Context ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('--- DRIVER: App Context Created ---');
  // Disable logging for cleaner output
  // app.useLogger(false);

  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger('GateP0R2Driver');

  // --- 0. Data Seeding ---
  console.log('--- DRIVER: Starting Seeding ---');

  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log('--- DRIVER: CLEANUP Project ---');
  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }

  // Ensure User exists for Org Owner
  console.log('--- DRIVER: UPSERT user ---');
  const user = await prisma.user.upsert({
    where: { id: 'gate_user' },
    update: {},
    create: {
      id: 'gate_user',
      email: 'gate@test.com',
      passwordHash: 'mock_hash',
    },
  });

  // Ensure 'system' user exists (fallback for Orchestrator)
  await prisma.user.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      email: 'system@test.com',
      passwordHash: 'mock_hash',
    },
  });

  // Ensure Project Hierarchy
  console.log('--- DRIVER: UPSERT org ---');
  const org = await prisma.organization.upsert({
    where: { id: 'org_gate_p0r2' },
    update: { credits: 1000 },
    create: {
      id: 'org_gate_p0r2',
      name: 'Gate Org',
      credits: 1000,
      owner: { connect: { id: user.id } },
    },
  });

  console.log('--- DRIVER: CREATE project ---');
  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name: 'Gate P0-R2 Project',
      organizationId: org.id,
      ownerId: user.id,
    },
  });

  // Engines (Required for Job Engine Binding)
  console.log('--- DRIVER: UPSERT engines ---');
  const engines = [
    { key: 'ce06_novel_parsing', type: 'CE06_NOVEL_PARSING' },
    { key: 'ce03_visual_density', type: 'CE03_VISUAL_DENSITY' },
    { key: 'ce04_visual_enrichment', type: 'CE04_VISUAL_ENRICHMENT' },
    { key: 'default_shot_render', type: 'SHOT_RENDER' }, // shot_render
    { key: 'video_merge', type: 'VIDEO_RENDER' },
  ];

  for (const eng of engines) {
    await prisma.engine.upsert({
      where: { code: eng.key },
      update: { isActive: true, enabled: true },
      create: {
        engineKey: eng.key,
        code: eng.key,
        name: eng.key,
        type: eng.type,
        adapterName: 'mock', // or http/local
        adapterType: 'internal',
        config: {},
        isActive: true,
        enabled: true,
      },
    });
  }

  // Novel Source (required for CE06)
  console.log('--- DRIVER: UPSERT novelSource ---');
  await prisma.novelSource.upsert({
    where: { id: TEST_NOVEL_SOURCE_ID },
    update: {},
    create: {
      id: TEST_NOVEL_SOURCE_ID,
      projectId: project.id,
      rawText: 'A dark night in the cyberpunk city.',
      fileName: 'test.txt',
      fileSize: 100,
      // importedAt removed, likely not in schema or auto-handled
    },
  });

  // Scene & Shot
  console.log('--- DRIVER: Creating Hierarchy (Season/Ep/Scene/Shot) ---');
  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don't clear generic hierarchy, we might fail if unique index exists?
  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let's use Upsert or check existence.
  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.

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

  console.log('--- DRIVER: CREATE shot ---');
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
  console.log('--- DRIVER: Seeding Complete, Triggering CE DAG ---');

  const req: CEDagRunRequest = {
    projectId: TEST_PROJECT_ID,
    shotId: TEST_SHOT_ID,
    novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
    runId: 'run-gate-p0r2-' + Date.now(),
    traceId: 'trace-gate-p0r2-' + Date.now(),
  };

  console.log(
    '--- DRIVER: Calling dagService.runCEDag with req:',
    JSON.stringify(req, null, 2),
    '---'
  );

  try {
    const result = await dagService.runCEDag(req);
    console.log('--- DRIVER: runCEDag returned ---');

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
