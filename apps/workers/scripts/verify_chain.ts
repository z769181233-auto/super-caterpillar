// @ts-nocheck
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
import { PrismaClient } from '../../../packages/database';
import { processCE06Job, processCE03Job, processCE04Job } from '../src/ce-core-processor';
// Adjust imports to point to src if packages are not linked in ts-node context
import { ce06RealEngine } from '../../../packages/engines/ce06/real';
import { ce03RealEngine } from '../../../packages/engines/ce03/real';
import { ce04RealEngine } from '../../../packages/engines/ce04/real';
import { EngineHubClient } from '../src/engine-hub-client';
import { ApiClient } from '../src/api-client';

// Mock Clients
class MockEngineHubClient extends EngineHubClient {
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }

  async invoke(params: any): Promise<any> {
    console.log(`[MockEngine] Invoking ${params.engineKey}...`);
    let output;
    let metrics = { usage: { totalTokens: 10 } };

    if (params.engineKey === 'ce06_novel_parsing') {
      output = await ce06RealEngine(params.payload);
    } else if (params.engineKey === 'ce03_visual_density') {
      output = await ce03RealEngine(params.payload);
    } else if (params.engineKey === 'ce04_visual_enrichment') {
      output = await ce04RealEngine(params.payload);
    } else if (params.engineKey === 'shot_render') {
      output = { asset: { uri: 'mock_asset', sha256: 'mock' }, render_meta: {} };
    } else {
      throw new Error(`Unknown engine: ${params.engineKey}`);
    }
    return { success: true, output, metrics };
  }
}

class MockApiClient extends ApiClient {
  async postAuditLog() {
    return { success: true };
  }
  async reportJobResult() {
    return { success: true };
  }
}

async function verifyChain() {
  const prisma = new PrismaClient();
  const apiClient = new MockApiClient('http://mock');
  const engineClient = new MockEngineHubClient(apiClient);

  const TEST_PROJECT_ID = 'proj_stage3_verify_' + Date.now();

  try {
    console.log('=== Setup Test Project ===');
    // 1. Create Project with Dependencies
    await prisma.project.create({
      data: {
        id: TEST_PROJECT_ID,
        name: 'Stage 3 Verify',
        status: 'in_progress',
        organization: {
          connectOrCreate: {
            where: { id: 'org_test_verify' },
            create: {
              id: 'org_test_verify',
              name: 'Test Org Verify',
              owner: {
                connectOrCreate: {
                  where: { id: 'tester' },
                  create: {
                    id: 'tester',
                    email: 'tester@example.com',
                    role: 'creator',
                    passwordHash: 'mock_hash',
                  },
                },
              },
            },
          },
        },
        owner: {
          connectOrCreate: {
            where: { id: 'tester' },
            create: {
              id: 'tester',
              email: 'tester@example.com',
              role: 'creator',
              passwordHash: 'mock_hash',
            },
          },
        },
      },
    });

    // 2. Create NovelSource
    await prisma.novelSource.create({
      data: {
        projectId: TEST_PROJECT_ID,
        novelTitle: 'Test Novel',
        rawText: `
Chapter 1
The dark, gloomy room was filled with neon blue lights and Cyberpunk smoke. The hero stood tall.
        `.trim(),
      },
    });

    // 3. Create Dummy Hierarchy for Schema Compliance (Season/Episode/Scene/Shot)
    const season = await prisma.season.create({
      data: { projectId: TEST_PROJECT_ID, index: 0, title: 'Dummy Season' },
    });
    const episode = await prisma.episode.create({
      data: { seasonId: season.id, index: 0, name: 'Dummy Episode', projectId: TEST_PROJECT_ID },
    });
    const sceneDummy = await prisma.scene.create({
      data: { episodeId: episode.id, index: 0, title: 'Dummy Scene', projectId: TEST_PROJECT_ID },
    });
    const shotDummy = await prisma.shot.create({
      data: { sceneId: sceneDummy.id, index: 0, type: 'dummy', organizationId: 'org_test_verify' },
    });

    console.log('=== Step 1: Execute CE06 (Novel Parsing) ===');
    // Note: We link to dummy episode/scene/shot to satisfy ShotJob constraints,
    // even though CE06 doesn't logically use them for parsing.
    const ce06Job = await prisma.shotJob.create({
      data: {
        projectId: TEST_PROJECT_ID,
        type: 'CE06_NOVEL_PARSING',
        status: 'RUNNING',
        organizationId: 'org_test_verify',
        traceId: 'trace_verify',
        episodeId: episode.id,
        sceneId: sceneDummy.id,
        shotId: shotDummy.id,
        // In Real App, parsing logic uses NovelSource, not these dummies.
        // We inject payload derived from source for this test?
        // No, processCE06Job logic should fetch or use payload.
        // real.ts parses `input.structured_text`.
        // ce-core-processor passes `job.payload`.
        // So we need payload.
        payload: { structured_text: `Chapter 1\nHero enters the dark room. He sees a blue light.` },
      },
    });

    await processCE06Job(prisma, ce06Job, engineClient, apiClient);
    console.log('✅ CE06 Completed. Checking DB...');

    const chapters = await prisma.novelChapter.findMany({
      where: { novelSource: { projectId: TEST_PROJECT_ID } },
    });
    if (chapters.length === 0) throw new Error('CE06 Failed: No chapters created');
    console.log(`✅ Chapters created: ${chapters.length}`);

    // Wait for scenes (they are created via nested relation in ce06 processor logic)
    const scenes = await prisma.novelScene.findMany({
      where: { chapterId: { in: chapters.map((c) => c.id) } },
    });
    if (scenes.length === 0) throw new Error('CE06 Failed: No scenes created');
    console.log(`✅ Scenes created: ${scenes.length}`);

    // Verify Orchestration: Check CE03 Jobs
    const ce03Jobs = await prisma.shotJob.findMany({
      where: { projectId: TEST_PROJECT_ID, type: 'CE03_VISUAL_DENSITY' },
    });
    if (ce03Jobs.length !== scenes.length)
      throw new Error(
        `Orchestration Failed: Expected ${scenes.length} CE03 jobs, found ${ce03Jobs.length}`
      );
    console.log(`✅ CE03 Jobs Triggered: ${ce03Jobs.length}`);

    console.log('=== Step 2: Execute CE03 (Visual Density) ===');
    const job03 = ce03Jobs[0];
    await processCE03Job(prisma, job03, engineClient, apiClient);

    // Verify CE03 Result
    const metrics03 = await prisma.qualityMetrics.findFirst({
      where: { jobId: job03.id, engine: 'CE03' },
    });
    // Visual count logic: "Hero"(1), "enters"(0), "dark"(1), "room"(1). "blue"(1), "light"(1).
    if (!metrics03 || metrics03.visualDensityScore <= 0)
      throw new Error('CE03 Failed: No valid score: ' + JSON.stringify(metrics03));
    console.log(`✅ CE03 Score: ${metrics03.visualDensityScore}`);

    // Verify Orchestration: Check CE04 Job
    const ce04Jobs = await prisma.shotJob.findMany({
      where: { projectId: TEST_PROJECT_ID, type: 'CE04_VISUAL_ENRICHMENT' },
    });
    if (ce04Jobs.length === 0)
      throw new Error('Orchestration Failed: CE03 -> CE04 trigger missing');
    console.log(`✅ CE04 Jobs Triggered: ${ce04Jobs.length}`);

    console.log('=== Step 3: Execute CE04 (Visual Enrichment) ===');
    const job04 = ce04Jobs[0];
    await processCE04Job(prisma, job04, engineClient, apiClient);

    // Verify CE04 Result
    const scene = await prisma.novelScene.findUnique({ where: { id: job04.payload.novelSceneId } });
    if (!scene?.enrichedText || !scene.enrichedText.includes('Cinematic')) {
      throw new Error('CE04 Failed: enrichedText not updated or incorrect format');
    }
    console.log(`✅ CE04 Enriched Text: "${scene.enrichedText.substring(0, 50)}..."`);

    console.log('=== SUCCESS: Full Stage 3 Pipeline Verified ===');
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    // Optional Cleanup: await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
    await prisma.$disconnect();
  }
}

verifyChain();
