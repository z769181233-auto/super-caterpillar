import { PrismaClient, ShotRenderStatus } from 'database';
import { processShotRenderJob } from '../apps/workers/src/processors/shot-render.processor';
import { ApiClient } from '../apps/workers/src/api-client';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({});
const apiClient = new ApiClient('http://localhost:3000');

// Mock EngineHubClient
import { EngineHubClient } from '../apps/workers/src/engine-hub-client';
EngineHubClient.prototype.invoke = async function (req: any) {
  console.log(`[MOCK_ENGINE] Invoked with ${req.engineKey}`);
  const repoRoot = process.env.REPO_ROOT || process.cwd();
  return {
    success: true,
    output: {
      asset: {
        uri: path.join(repoRoot, '.runtime/assets/source_p3_test.png'),
      },
    },
  } as any;
};

async function setupTestData() {
  // 1. Ensure User
  const user = await prisma.user.upsert({
    where: { email: 'system@supercaterpillar.com' },
    update: {},
    create: {
      id: 'system_user_p3',
      email: 'system@supercaterpillar.com',
      passwordHash: 'mock',
    },
  });

  // 2. Organization
  const org = await prisma.organization.upsert({
    where: { id: 'org_p3_test' },
    update: { ownerId: user.id },
    create: {
      id: 'org_p3_test',
      name: 'P3 Test Org',
      ownerId: user.id,
    },
  });

  // 3. Project
  const project = await prisma.project.upsert({
    where: { id: 'proj_p3_test' },
    update: {},
    create: {
      id: 'proj_p3_test',
      name: 'P3 Test Project',
      organizationId: org.id,
      ownerId: user.id,
    },
  });

  // 4. Tree: Season -> Episode -> Scene
  const season = await prisma.season.upsert({
    where: { projectId_index: { projectId: project.id, index: 1 } },
    update: {},
    create: {
      id: 'season_p3',
      projectId: project.id,
      index: 1,
      title: 'Season 1',
    },
  });

  const episode = await prisma.episode.upsert({
    where: { id: 'ep_p3' },
    update: {},
    create: {
      id: 'ep_p3',
      seasonId: season.id,
      projectId: project.id,
      index: 1,
      name: 'Episode 1',
    },
  });

  const scene = await prisma.scene.upsert({
    where: { id: 'sc_p3' },
    update: {},
    create: {
      id: 'sc_p3',
      episodeId: episode.id,
      projectId: project.id,
      sceneIndex: 1,
      title: 'Scene 1',
    },
  });

  // 5. Character
  const charId = 'ch_xue_zhiying';
  const char = await prisma.character.upsert({
    where: { id: charId },
    update: {},
    create: {
      id: charId,
      name: '薛知盈',
      projectId: project.id,
    },
  });

  return { org, project, scene, char };
}

async function runPositive() {
  console.log('--- STARTING POSITIVE E2E ---');
  const { org, project, scene, char } = await setupTestData();

  // 1. Prepare Anchor
  await prisma.characterIdentityAnchor.upsert({
    where: { id: 'anchor_p3_positive' },
    update: { status: 'READY', isActive: true },
    create: {
      id: 'anchor_p3_positive',
      characterId: char.id,
      status: 'READY',
      isActive: true,
      seed: 12345,
      viewKeysSha256: 'mock_sha_for_test',
    },
  });

  // 2. Prepare Shot
  const shotId = `shot_pos_${Date.now()}`;
  const shot = await prisma.shot.create({
    data: {
      id: shotId,
      sceneId: scene.id,
      organizationId: org.id,
      index: 1,
      type: 'MEDIUM_SHOT',
      enrichedPrompt: 'A beautiful girl in traditional clothes, cinematic',
      renderStatus: 'PENDING',
      params: { characterIds: [char.id] },
    },
  });

  // 3. Mock Job and DB record
  const jobId = `job_pos_${Date.now()}`;
  await prisma.shotJob.create({
    data: {
      id: jobId,
      organizationId: org.id,
      projectId: project.id,
      shotId: shot.id,
      type: 'SHOT_RENDER',
      status: 'PENDING',
      payload: { pipelineRunId: 'pipe_pos_001', characterIds: [char.id] },
    },
  });

  const job = {
    id: jobId,
    shotId: shot.id,
    projectId: project.id,
    payload: {
      pipelineRunId: 'pipe_pos_001',
      characterIds: [char.id],
    },
  } as any;

  // 4. Run Processor
  const result = await processShotRenderJob({ prisma, job, apiClient, logger: console });
  console.log('Positive Result:', JSON.stringify(result, null, 2));
}

async function runNegative() {
  console.log('--- STARTING NEGATIVE E2E ---');
  const { org, project, scene, char } = await setupTestData();

  // 1. Sabotage Anchor (Make it inactive)
  await prisma.characterIdentityAnchor.upsert({
    where: { id: 'anchor_p3_positive' }, // Same ID to sabotage it
    update: { isActive: false },
    create: { id: 'anchor_p3_positive', characterId: char.id, status: 'READY', isActive: false },
  });

  // 2. Prepare Shot
  const shotId = `shot_neg_${Date.now()}`;
  const shot = await prisma.shot.create({
    data: {
      id: shotId,
      sceneId: scene.id,
      organizationId: org.id,
      index: 2,
      type: 'CLOSE_UP',
      enrichedPrompt: 'A beautiful girl crying, cinematic',
      renderStatus: 'PENDING',
      params: { characterIds: [char.id] },
    },
  });

  // 3. Mock Job and DB record (Negative)
  const jobId = `job_neg_${Date.now()}`;
  await prisma.shotJob.create({
    data: {
      id: jobId,
      organizationId: org.id,
      projectId: project.id,
      shotId: shot.id,
      type: 'SHOT_RENDER',
      status: 'PENDING',
      payload: { pipelineRunId: 'pipe_neg_001', characterIds: [char.id] },
    },
  });

  const job = {
    id: jobId,
    shotId: shot.id,
    projectId: project.id,
    payload: {
      pipelineRunId: 'pipe_neg_001',
      characterIds: [char.id],
    },
  } as any;

  // 4. Run Processor (expect catch/fail)
  try {
    await processShotRenderJob({ prisma, job, apiClient, logger: console });
    console.log('Negative Result: Unexpected Success');
  } catch (err: any) {
    console.log('Negative Result (Expected Failure):', err.message);

    // Check Shot status in DB
    const updatedShot = await prisma.shot.findUnique({ where: { id: shotId } });
    console.log(`[SQL_ASSERTION] shot.renderStatus = ${updatedShot?.renderStatus}`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'positive') await runPositive();
  else if (mode === 'negative') await runNegative();
  else {
    await runPositive();
    await runNegative();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
