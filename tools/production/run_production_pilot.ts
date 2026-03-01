import { ApiClient } from '../../apps/workers/src/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { PrismaClient, JobType } from '../../packages/database/src/generated/prisma';

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------
const START_TS = new Date();
const TRACE_ID = `pilot_${Date.now()}`;
const PIPELINE_RUN_ID = TRACE_ID;

const PROJECT_ID = `prod-pilot-${TRACE_ID}`;
const ORGANIZATION_ID = 'default-org';
const WORKER_ID = 'prod-pilot-orchestrator';

// Load Environment
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const API_KEY = process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET =
  process.env.WORKER_API_SECRET ||
  'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

const prisma = new PrismaClient();
const apiClient = new ApiClient('http://localhost:3000', API_KEY, API_SECRET, WORKER_ID);

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitJobsExist(
  projectId: string,
  type: string,
  minCount: number,
  timeoutMs = 180000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cnt = await prisma.shotJob.count({
      where: {
        projectId,
        type: type as any,
        traceId: TRACE_ID,
        createdAt: { gte: START_TS },
      } as any,
    });
    if (cnt >= minCount) return cnt;
    await sleep(2000);
  }
  throw new Error(`[WAIT_EXIST_TIMEOUT] ${type} minCount=${minCount}`);
}

async function waitJobsDone(projectId: string, type: string, timeoutMs = 600000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = await prisma.shotJob.count({
      where: {
        projectId,
        type: type as any,
        traceId: TRACE_ID,
        status: { in: ['PENDING', 'RUNNING'] },
        createdAt: { gte: START_TS },
      } as any,
    });
    const failed = await prisma.shotJob.count({
      where: {
        projectId,
        type: type as any,
        traceId: TRACE_ID,
        status: 'FAILED',
        createdAt: { gte: START_TS },
      } as any,
    });
    const total = await prisma.shotJob.count({
      where: {
        projectId,
        type: type as any,
        traceId: TRACE_ID,
        createdAt: { gte: START_TS },
      } as any,
    });

    if (failed > 0) {
      const bad = await prisma.shotJob.findFirst({
        where: {
          projectId,
          type: type as any,
          traceId: TRACE_ID,
          status: 'FAILED',
          createdAt: { gte: START_TS },
        } as any,
        select: { id: true, lastError: true } as any,
      });
      throw new Error(`[JOB_FAILED] ${type} id=${bad?.id} err=${bad?.lastError || 'unknown'}`);
    }

    if (total > 0 && pending === 0) return total;
    await sleep(3000);
  }
  throw new Error(`[WAIT_DONE_TIMEOUT] ${type}`);
}

async function main() {
  console.log('🚀 [Production Pilot] Starting Full-Chain Execution (SEALED_42)');
  console.log(`Target Project: ${PROJECT_ID}`);
  console.log(`Trace ID: ${TRACE_ID}`);

  // P-2: Read Input from CLI Arg or Default
  const inputPath = process.argv[2];
  let rawText =
    'Scene 1: The Pilot.\nLight filters through the digital canopy. A single pixel blooms into a flower.';

  if (inputPath && fs.existsSync(inputPath)) {
    console.log(`📖 Reading input from: ${inputPath}`);
    rawText = fs.readFileSync(inputPath, 'utf-8');
  } else {
    console.warn('⚠️ No input file provided or file not found. Using default text.');
  }

  try {
    // 1. Setup Project & Novel
    console.log('\n[Step 1] Initializing Project Data...');

    // Ensure User exists
    await prisma.user.upsert({
      where: { id: 'pilot-runner' },
      update: {},
      create: { id: 'pilot-runner', email: 'pilot@scu.com', passwordHash: 'noop' },
    });

    // Ensure Organization exists
    await prisma.organization.upsert({
      where: { id: ORGANIZATION_ID },
      update: {},
      create: { id: ORGANIZATION_ID, name: 'Pilot Org', ownerId: 'pilot-runner' } as any,
    });

    await prisma.project.upsert({
      where: { id: PROJECT_ID },
      update: {},
      create: {
        id: PROJECT_ID,
        name: 'Prod Pilot Sealed42',
        organizationId: ORGANIZATION_ID,
        ownerId: 'pilot-runner',
      } as any,
    });

    const novelId = 'novel-pilot-01';
    await prisma.novel.upsert({
      where: { id: novelId },
      update: {},
      create: {
        id: novelId,
        title: 'Pilot Novel',
        projectId: PROJECT_ID,
        status: 'Active',
        author: 'pilot-author',
      },
    });

    // 2. Trigger CE06 (Novel Parsing)
    console.log('\n[Step 2] Triggering CE06_NOVEL_PARSING...');
    const jobCE06 = await prisma.shotJob.create({
      data: {
        type: 'CE06_NOVEL_PARSING',
        projectId: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        status: 'PENDING',
        priority: 100,
        traceId: TRACE_ID,
        payload: {
          sourceText: rawText, // ✅ Worker 端读取的是 sourceText / text
          pipelineRunId: PIPELINE_RUN_ID,
          novelSourceId: novelId, // 可留着（不强依赖）
        },
      } as any,
    });
    console.log(`   Job Created: ${jobCE06.id}`);
    await pollJob(jobCE06.id, 'CE06_NOVEL_PARSING');

    // [Step 2.0.1] Script Compilation (SSOT)
    console.log('\n[Step 2.0.1] Compiling Video Script (SSOT)...');
    execSync(`npx ts-node tools/prod/compile_video_script.ts ${PROJECT_ID}`, { stdio: 'inherit' });

    // [Step 2.0.2] Character Turnaround (Asset Gen)
    console.log('\n[Step 2.0.2] Generating Character Turnarounds...');
    execSync(`PROJECT_ID=${PROJECT_ID} npx ts-node tools/prod/run_character_turnaround.ts`, {
      stdio: 'inherit',
    });

    // [Step 2.1] Waiting CE03 -> CE04 (async orchestration by worker)
    console.log('\n[Step 2.1] Waiting CE03 -> CE04 (async orchestration by worker)...');

    // 先等 CE03 至少出现 1 个
    const ce03Total = await waitJobsExist(PROJECT_ID, 'CE03_VISUAL_DENSITY', 1, 240000);
    console.log(`   CE03 exists: ${ce03Total}`);

    // 再等 CE03 全部完成
    const ce03Done = await waitJobsDone(PROJECT_ID, 'CE03_VISUAL_DENSITY', 900000);
    console.log(`   CE03 done: ${ce03Done}`);

    // CE03 每个 novelSceneId 会触发 1 个 CE04；因此 CE04 期望数量 = CE03 数量
    const ce04Total = await waitJobsExist(PROJECT_ID, 'CE04_VISUAL_ENRICHMENT', ce03Done, 240000);
    console.log(`   CE04 exists: ${ce04Total}`);

    // 等 CE04 全部完成（frames.txt 必须已经落盘）
    const ce04Done = await waitJobsDone(PROJECT_ID, 'CE04_VISUAL_ENRICHMENT', 1800000);
    console.log(`   CE04 done: ${ce04Done}`);

    // [Step 2.2] Verifying frames.txt exists for all shots (CE04 output)
    console.log('\n[Step 2.2] Verifying frames.txt exists for all shots (CE04 output)...');
    const cinemaScenes = await prisma.scene.findMany({
      where: { episode: { projectId: PROJECT_ID } } as any,
    });

    let shotCount = 0;
    for (const s of cinemaScenes) {
      // Simplify query to avoid type confusion with 'as any'
      const shots = await prisma.shot.findMany({ where: { sceneId: s.id } });
      for (const sh of shots) {
        shotCount++;
        const framesTxt = path.join(
          process.cwd(),
          '.runtime',
          'frames',
          String(sh.id),
          'frames.txt'
        );
        if (!fs.existsSync(framesTxt)) {
          // Do not fail here yet if running fresh, as CE04 might just have finished.
          // But T1 logic says we waited for CE04 Done.
          // So frames.txt MUST exist.
          throw new Error(`[NO_FRAMES_TXT] ${framesTxt}`);
        }
      }
    }
    console.log(`   OK frames.txt present. shots=${shotCount}`);

    // 3. Trigger SHOT_RENDER for all created scenes
    console.log('\n[Step 3] Triggering SHOT_RENDER...');
    // Fixed: Use correct query matching Worker logic (Episode relation)
    const scenes = await prisma.scene.findMany({
      where: { episode: { projectId: PROJECT_ID } } as any,
    });
    console.log(`   Found ${scenes.length} scenes.`);
    if (scenes.length === 0) throw new Error('No scenes created by CE06');

    for (const scene of scenes) {
      const shots = await prisma.shot.findMany({ where: { sceneId: scene.id } });
      console.log(`   Scene ${scene.id}: Found ${shots.length} shots.`);

      for (const shot of shots) {
        // Determine prompt (simplified logic)
        const prompt = (shot.params as any)?.prompt || 'Default cinematic shot';
        const jobShot = await prisma.shotJob.create({
          data: {
            type: 'SHOT_RENDER',
            projectId: PROJECT_ID,
            organizationId: ORGANIZATION_ID,
            status: 'PENDING',
            priority: 90,
            traceId: TRACE_ID,
            payload: {
              shotId: shot.id,
              sceneId: scene.id,
              prompt,
              productionMode: true,
            },
            shotId: shot.id,
            sceneId: scene.id,
          },
        });
        console.log(`     -> ShotJob Created: ${jobShot.id}`);
      }
    }

    // Wait for all SHOT_RENDER jobs
    await pollAllPendingJobs(PROJECT_ID, 'SHOT_RENDER');

    // 4. Trigger TIMELINE_COMPOSE
    console.log('\n[Step 4] Triggering TIMELINE_COMPOSE...');
    for (const scene of scenes) {
      const jobCompose = await prisma.shotJob.create({
        data: {
          type: 'PIPELINE_TIMELINE_COMPOSE',
          projectId: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          status: 'PENDING',
          traceId: TRACE_ID,
          payload: {
            sceneId: scene.id,
            pipelineRunId: PIPELINE_RUN_ID,
            bgmMode: 'loop',
          },
          sceneId: scene.id,
        },
      });
      console.log(`   Compose Job Created: ${jobCompose.id} (Scene: ${scene.id})`);
    }
    await pollAllPendingJobs(PROJECT_ID, 'PIPELINE_TIMELINE_COMPOSE');

    // 5. Trigger TIMELINE_RENDER
    console.log('\n[Step 5] Triggering TIMELINE_RENDER...');
    // Match Compose Jobs triggered in Step 4
    const composeResults = await prisma.shotJob.findMany({
      where: {
        projectId: PROJECT_ID,
        type: 'PIPELINE_TIMELINE_COMPOSE',
        status: 'SUCCEEDED',
        createdAt: { gt: START_TS },
        traceId: TRACE_ID,
      },
    });

    // Dedupe scenes
    const handledScenes = new Set<string>();
    const renderJobs: any[] = [];

    for (const j of composeResults) {
      const sid = (j.payload as any).sceneId as string;
      if (handledScenes.has(sid)) continue;
      handledScenes.add(sid);

      const timelineKey = (j.result as any)?.output?.timelineStorageKey;
      if (!timelineKey) {
        console.error(`   ❌ Missing timelineKey for job ${j.id}`);
        continue;
      }

      const jobRender = await prisma.shotJob.create({
        data: {
          type: 'TIMELINE_RENDER',
          projectId: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          status: 'PENDING',
          traceId: TRACE_ID,
          payload: {
            sceneId: sid,
            timelineStorageKey: timelineKey,
            pipelineRunId: PIPELINE_RUN_ID,
          },
          sceneId: sid,
        },
      });
      console.log(`   Render Job Created: ${jobRender.id} (Scene: ${sid})`);
      renderJobs.push(jobRender.id);
    }
    await pollAllPendingJobs(PROJECT_ID, 'TIMELINE_RENDER');

    // 6. Report Outputs
    console.log('\n[Step 6] Gathering Artifacts...');
    const finalJobs = await prisma.shotJob.findMany({
      where: {
        id: { in: renderJobs },
      },
    });

    const storageRoot = path.resolve(process.env.STORAGE_ROOT || '.data/storage');
    for (const j of finalJobs) {
      if (j.status === 'SUCCEEDED') {
        const assetPath = (j.result as any)?.storageKey;
        console.log(`   ✅ SUCCESS: ${assetPath}`);

        // P4: Non-Placeholder Gate
        const absAssetPath = path.join(storageRoot, assetPath);
        console.log(`   🔍 Running Quality Gate on ${absAssetPath}...`);
        try {
          execSync(`bash tools/gate_non_placeholder_video.sh "${absAssetPath}"`, {
            stdio: 'inherit',
          });
          console.log(`   🏁 GATE PASS`);
        } catch (gateErr: any) {
          console.error(`   ❌ GATE FAIL: Video quality check failed!`);
          throw gateErr;
        }
      } else {
        console.error(`   ❌ FAILED: Job ${j.id} - ${(j.result as any)?.error || j.lastError}`);
      }
    }
  } catch (e: any) {
    console.error('CRITICAL FAILURE:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function pollJob(jobId: string, type: JobType | string) {
  process.stdout.write(`   Polling ${type} [${jobId}] `);
  while (true) {
    const j = await prisma.shotJob.findUnique({ where: { id: jobId } });
    if (!j) throw new Error(`Job ${jobId} not found`);

    if (j.status === 'SUCCEEDED') {
      process.stdout.write(' ✅\n');
      return j;
    }
    if (j.status === 'FAILED') {
      process.stdout.write(' ❌\n');
      throw new Error(`Job ${jobId} failed: ${j.lastError}`);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function pollAllPendingJobs(projectId: string, type: JobType) {
  process.stdout.write(`   Polling ALL pending ${type}...`);
  let retries = 0;
  while (true) {
    const pending = await prisma.shotJob.count({
      where: { projectId, type, status: { in: ['PENDING', 'RUNNING'] }, traceId: TRACE_ID },
    });

    if (pending === 0) {
      process.stdout.write(' Done.\n');
      break;
    }

    process.stdout.write(`.${pending}`);
    await new Promise((r) => setTimeout(r, 3000));
    retries++;
    if (retries > 300) throw new Error('Timeout polling jobs'); // 15 mins
  }
}

main();
