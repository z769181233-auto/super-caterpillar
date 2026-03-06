import { PrismaClient } from '@prisma/client';
import {
  processCE06Job,
  processCE03Job,
  processCE04Job,
} from '../apps/workers/src/ce-core-processor';
import { ce06RealEngine } from '../packages/engines/ce06/real';
import { ce03RealEngine } from '../packages/engines/ce03/real';
import { ce04RealEngine } from '../packages/engines/ce04/real';
import { EngineHubClient } from '../apps/workers/src/engine-hub-client';
import { ApiClient } from '../apps/workers/src/api-client';

// Mock Clients
class MockEngineHubClient extends EngineHubClient {
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
  const prisma = new PrismaClient({});
  const engineClient = new MockEngineHubClient('http://mock', 'key', 'secret');
  const apiClient = new MockApiClient('http://mock');

  const TEST_PROJECT_ID = 'proj_stage3_verify_' + Date.now();

  try {
    console.log('=== Setup Test Project ===');
    // 1. Create Project & NovelSource
    await prisma.project.create({
      data: {
        id: TEST_PROJECT_ID,
        name: 'Stage 3 Verify',
        ownerId: 'tester',
        status: 'ACTIVE',
      },
    });

    await prisma.novelSource.create({
      data: {
        projectId: TEST_PROJECT_ID,
        title: 'Test Novel',
        rawText: `
Chapter 1
Hero enters the dark room. He sees a blue light.
        `.trim(),
        status: 'PROCESSING',
      },
    });

    console.log('=== Step 1: Execute CE06 (Novel Parsing) ===');
    const ce06Job = await prisma.shotJob.create({
      data: {
        projectId: TEST_PROJECT_ID,
        type: 'CE06_NOVEL_PARSING',
        status: 'RUNNING',
        organizationId: 'org_test',
        traceId: 'trace_verify',
      },
    });

    await processCE06Job(prisma, ce06Job as any, engineClient, apiClient);
    console.log('✅ CE06 Completed. Checking DB...');

    const chapters = await prisma.novelChapter.findMany({
      where: { novelSource: { projectId: TEST_PROJECT_ID } },
    });
    if (chapters.length === 0) throw new Error('CE06 Failed: No chapters created');
    console.log(`✅ Chapters created: ${chapters.length}`);

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
    await processCE03Job(prisma, job03 as any, engineClient, apiClient);

    // Verify CE03 Result
    const metrics03 = await prisma.qualityMetrics.findFirst({
      where: { jobId: job03.id, engine: 'CE03' },
    });
    if (!metrics03 || metrics03.visualDensityScore <= 0)
      throw new Error('CE03 Failed: No valid score');
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
    await processCE04Job(prisma, job04 as any, engineClient, apiClient);

    // Verify CE04 Result
    const scene = await prisma.novelScene.findUnique({
      where: { id: (job04.payload as any).novelSceneId },
    });
    if (!scene?.enrichedText || !scene.enrichedText.includes('Cinematic')) {
      throw new Error('CE04 Failed: enrichedText not updated or incorrect format');
    }
    console.log(`✅ CE04 Enriched Text: "${scene.enrichedText.substring(0, 50)}..."`);

    console.log('=== SUCCESS: Full Stage 3 Pipeline Verified ===');
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyChain();
