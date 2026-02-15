import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CEDagOrchestratorService } from '../ce-pipeline/ce-dag-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CEDagRunRequest } from '../ce-pipeline/ce-dag.types';
import { Logger } from '@nestjs/common';
import { JobType } from 'database';
import * as util from 'util';

// Mock Input
const TEST_PROJECT_ID = `test-project-p0r2-${Date.now()}`;
const TEST_NOVEL_SOURCE_ID = `test-novel-p0r2-${Date.now()}`;
const TEST_SHOT_ID = `test-shot-p0r2-${Date.now()}`;
const TEST_SCENE_ID = `test-scene-p0r2-${Date.now()}`;

async function main() {
  process.stdout.write(util.format('--- DRIVER: Creating App Context ---') + '\n');
  const app = await NestFactory.createApplicationContext(AppModule);
  process.stdout.write(util.format('--- DRIVER: App Context Created ---') + '\n');
  // Disable logging for cleaner output
  // app.useLogger(false);

  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger('GateP0R2Driver');

  // --- 0. Data Seeding ---
  process.stdout.write(util.format('--- DRIVER: Starting Seeding ---') + '\n');

  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  process.stdout.write(util.format('--- DRIVER: CLEANUP Project ---') + '\n');
  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }

  // Ensure User exists for Org Owner
  process.stdout.write(util.format('--- DRIVER: UPSERT user ---') + '\n');
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
  process.stdout.write(util.format('--- DRIVER: UPSERT org ---') + '\n');
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

  process.stdout.write(util.format('--- DRIVER: CREATE project ---') + '\n');
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
  process.stdout.write(util.format('--- DRIVER: UPSERT engines ---') + '\n');
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

  // Novel Source (required for CE06) - SSOT: schema.prisma line 784
  process.stdout.write(util.format('--- DRIVER: UPSERT novel ---') + '\n');
  await (prisma.novel as any).upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      title: 'Gate P0-R2 Novel',
      author: 'Gate System',
      organizationId: org.id,
      fileName: 'test.txt',
      fileSize: 100,
    },
  });

  // Episode & Scene & Shot
  process.stdout.write(
    util.format('--- DRIVER: Creating Hierarchy (Ep/Scene/Shot) ---') + '\n'
  );

  const episode = await prisma.episode.create({
    data: { seasonId: null, projectId: project.id, index: 1, name: 'E1' },
  });
  const scene = await prisma.scene.create({
    data: {
      id: TEST_SCENE_ID,
      episodeId: episode.id,
      projectId: project.id,
      sceneIndex: 1, // V3.0
      title: 'Scene 1',
      summary: 'A dark night.',
    },
  });

  process.stdout.write(util.format('--- DRIVER: CREATE shot ---') + '\n');
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
  process.stdout.write(util.format('--- DRIVER: Seeding Complete, Triggering CE DAG ---') + '\n');

  const req: CEDagRunRequest = {
    projectId: TEST_PROJECT_ID,
    shotId: TEST_SHOT_ID,
    novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
    runId: 'run-gate-p0r2-' + Date.now(),
    traceId: 'trace-gate-p0r2-' + Date.now(),
  };

  process.stdout.write(
    util.format(
      '--- DRIVER: Calling dagService.runCEDag with req:',
      JSON.stringify(req, null, 2),
      '---'
    ) + '\n'
  );

  try {
    const result = await dagService.runCEDag(req);
    process.stdout.write(util.format('--- DRIVER: runCEDag returned ---') + '\n');

    process.stdout.write(util.format('__RESULT_START__') + '\n');
    process.stdout.write(util.format(JSON.stringify(result, null, 2)) + '\n');
    process.stdout.write(util.format('__RESULT_END__') + '\n');
  } catch (e) {
    process.stderr.write(util.format('DAG Execution Failed:', e) + '\n');
    process.exit(1);
  }

  await app.close();
}

main().catch(console.error);
