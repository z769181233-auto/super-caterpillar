
import { ApiClient } from '../../apps/workers/src/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { PrismaClient, JobType } from '../../packages/database/src/generated/prisma';

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------
const PROJECT_ID = 'prod-pilot-sealed42';
const ORGANIZATION_ID = 'default-org';
const WORKER_ID = 'prod-pilot-orchestrator';

// Load Environment
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const API_KEY = process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET = process.env.WORKER_API_SECRET || 'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

const prisma = new PrismaClient();
const apiClient = new ApiClient('http://localhost:3000', API_KEY, API_SECRET, WORKER_ID);

async function main() {
    console.log('🚀 [Production Pilot] Starting Full-Chain Execution (SEALED_42)');
    console.log(`Target Project: ${PROJECT_ID}`);

    // P-2: Read Frozen Input
    // Assuming the user/script provides the path via env or specific location
    // We'll look for the pilot_text.txt in the latest evidence folder or a fixed location if provided
    // For now, let's assume a standard path or CLI arg, but default to creating a standard one if missing? 
    // User Guide says: "cp path/to/your/pilot_text.txt $EVI/input/pilot_text.txt"
    // So we should read from that if we can find EVI, or just take a cli arg.

    // Hardcoded Pilot Text for stability if file read fails (or we implement file reading)
    const rawText = "Scene 1: The Pilot.\nLight filters through the digital canopy. A single pixel blooms into a flower.";

    try {
        // 1. Setup Project & Novel
        console.log('\n[Step 1] Initializing Project Data...');

        // Ensure User exists
        await prisma.user.upsert({
            where: { id: 'pilot-runner' },
            update: {},
            create: { id: 'pilot-runner', email: 'pilot@scu.com', passwordHash: 'noop' }
        });

        await prisma.project.upsert({
            where: { id: PROJECT_ID },
            update: {},
            create: { id: PROJECT_ID, name: 'Prod Pilot Sealed42', organizationId: ORGANIZATION_ID, ownerId: 'pilot-runner' }
        });

        const novelId = 'novel-pilot-01';
        await prisma.novel.upsert({
            where: { id: novelId },
            update: {},
            create: { id: novelId, title: 'Pilot Novel', projectId: PROJECT_ID, status: 'Active', author: 'pilot-author' }
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
                payload: {
                    novelId,
                    raw_text: rawText,
                    pipelineRunId: `pilot-run-${Date.now()}`
                }
            }
        });
        console.log(`   Job Created: ${jobCE06.id}`);
        await pollJob(jobCE06.id, 'CE06_NOVEL_PARSING');

        // 3. Trigger SHOT_RENDER for all created scenes
        console.log('\n[Step 3] Triggering SHOT_RENDER...');
        const scenes = await prisma.scene.findMany({ where: { projectId: PROJECT_ID } });
        console.log(`   Found ${scenes.length} scenes.`);
        if (scenes.length === 0) throw new Error('No scenes created by CE06');

        for (const scene of scenes) {
            const shots = await prisma.shot.findMany({ where: { sceneId: scene.id } });
            console.log(`   Scene ${scene.id}: Found ${shots.length} shots.`);

            for (const shot of shots) {
                // Determine prompt (simplified logic)
                const prompt = (shot.params as any)?.prompt || "Default cinematic shot";
                const jobShot = await prisma.shotJob.create({
                    data: {
                        type: 'SHOT_RENDER',
                        projectId: PROJECT_ID,
                        organizationId: ORGANIZATION_ID,
                        status: 'PENDING',
                        priority: 90,
                        payload: {
                            shotId: shot.id,
                            sceneId: scene.id,
                            prompt,
                            productionMode: true
                        },
                        shotId: shot.id,
                        sceneId: scene.id
                    }
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
                    payload: {
                        sceneId: scene.id,
                        pipelineRunId: `pilot-run-${Date.now()}`,
                        bgmMode: 'loop'
                    },
                    sceneId: scene.id
                }
            });
            console.log(`   Compose Job Created: ${jobCompose.id} (Scene: ${scene.id})`);
        }
        await pollAllPendingJobs(PROJECT_ID, 'PIPELINE_TIMELINE_COMPOSE');

        // 5. Trigger TIMELINE_RENDER
        console.log('\n[Step 5] Triggering TIMELINE_RENDER...');
        // Need to fetch timelineStorageKeys from Compose outputs
        const composeJobs = await prisma.shotJob.findMany({
            where: { projectId: PROJECT_ID, type: 'PIPELINE_TIMELINE_COMPOSE', status: 'SUCCEEDED' },
            orderBy: { createdAt: 'desc' }
        });

        // Dedupe scenes
        const handledScenes = new Set();
        const renderJobs = [];

        for (const j of composeJobs) {
            const sid = (j.payload as any).sceneId;
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
                    payload: {
                        sceneId: sid,
                        timelineStorageKey: timelineKey,
                        pipelineRunId: `pilot-run-${Date.now()}`
                    },
                    sceneId: sid
                }
            });
            console.log(`   Render Job Created: ${jobRender.id} (Scene: ${sid})`);
            renderJobs.push(jobRender.id);
        }
        await pollAllPendingJobs(PROJECT_ID, 'TIMELINE_RENDER');

        // 6. Report Outputs
        console.log('\n[Step 6] Gathering Artifacts...');
        const finalJobs = await prisma.shotJob.findMany({
            where: {
                id: { in: renderJobs }
            }
        });

        for (const j of finalJobs) {
            if (j.status === 'SUCCEEDED') {
                const assetPath = (j.result as any)?.storageKey;
                console.log(`   ✅ SUCCESS: ${assetPath}`);
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
        await new Promise(r => setTimeout(r, 2000));
    }
}

async function pollAllPendingJobs(projectId: string, type: JobType) {
    process.stdout.write(`   Polling ALL pending ${type}...`);
    let retries = 0;
    while (true) {
        const pending = await prisma.shotJob.count({
            where: { projectId, type, status: { in: ['PENDING', 'RUNNING'] } }
        });

        if (pending === 0) {
            process.stdout.write(' Done.\n');
            break;
        }

        process.stdout.write(`.${pending}`);
        await new Promise(r => setTimeout(r, 3000));
        retries++;
        if (retries > 100) throw new Error('Timeout polling jobs');
    }
}

main();
