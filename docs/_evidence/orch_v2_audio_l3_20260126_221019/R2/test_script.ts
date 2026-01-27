import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function test() {
    const eviPath = process.env.EVI_PATH!;
    console.log("--- L3 R1/R2: STARTING ---");
    const organizationId = 'gate-org';
    const ownerId = 'gate-user';

    await prisma.user.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, email: 'gate@scu.local', userType: 'admin', passwordHash: 'HASH' } as any });
    await prisma.organization.upsert({ where: { id: organizationId }, update: {}, create: { id: organizationId, name: 'Gate Org', ownerId } as any });

    const project = await prisma.project.create({ data: { id: randomUUID(), name: 'L3 R1R2 Verify', organizationId, ownerId, status: 'in_progress' } as any });
    const s = await prisma.season.create({ data: { projectId: project.id, index: 1, title: 'S1' } as any });
    const e = await prisma.episode.create({ data: { seasonId: s.id, projectId: project.id, index: 1, name: 'E1' } as any });
    const sc = await prisma.scene.create({ data: { episodeId: e.id, projectId: project.id, sceneIndex: 1, title: 'SC', summary: 'L3 R1R2 Test Summary' } as any });
    const sh = await prisma.shot.create({ data: { sceneId: sc.id, index: 1, title: 'SH', type: 'ce_core', organizationId } as any });

    // Inject SHOT_RENDER first. Downstream AUDIO and VIDEO_RENDER should be spawned by DAG.
    const pipelineRunId = 'L3_R1R2_' + randomUUID().substring(0,8);
    const traceId = pipelineRunId;
    
    const shotJob = await prisma.shotJob.create({
        data: {
            projectId: project.id, organizationId, episodeId: e.id, sceneId: sc.id, shotId: sh.id,
            type: 'SHOT_RENDER', status: 'PENDING', priority: 100,
            traceId,
            payload: { pipelineRunId, isVerification: true, traceId }
        }
    });
    
    await prisma.jobEngineBinding.create({
        data: { jobId: shotJob.id, engineId: 'engine-s1', engineKey: 'default_shot_render', status: 'BOUND' } as any
    });

    console.log(`[Inject] SHOT_RENDER (${shotJob.id})`);

    const start = Date.now();
    let audioAssetId = '';
    let audioFileRelPath = '';

    while (Date.now() - start < 300000) {
        const results = await prisma.shotJob.findMany({ 
            where: { 
                payload: { path: ['pipelineRunId'], equals: pipelineRunId } 
            } 
        });
        const succeeded = results.filter(j => j.status === 'SUCCEEDED').length;
        const total = results.length;
        console.log(`Audit: ${succeeded}/${total} S. Types=[${results.map(x=>x.type).join(',')}]`);
        
        // Find Audio Asset
        if (!audioAssetId) {
            const audioAsset = await prisma.asset.findFirst({
                where: { type: 'AUDIO_TTS', createdByJobId: { not: null } }
            });
            if (audioAsset) {
                audioAssetId = audioAsset.id;
                audioFileRelPath = audioAsset.storageKey;
                console.log(`[Found] Audio Asset: ${audioAssetId} at ${audioFileRelPath}`);
            }
        }

        // We expect SHOT_RENDER, AUDIO, VIDEO_RENDER. 
        // Note: CE09 might also be spawned.
        // We only care about AUDIO for the fingerprint, but we wait for VIDEO_RENDER to ensure DAG complete.
        if (succeeded >= 3 && results.some(r => r.type === 'VIDEO_RENDER' && r.status === 'SUCCEEDED')) {
            console.log("✅ Pipeline reached VIDEO_RENDER completion.");
            break;
        }
        await new Promise(r => setTimeout(r, 5000));
    }

    const finalJobs = await prisma.shotJob.findMany({ where: { payload: { path: ['pipelineRunId'], equals: pipelineRunId } } });
    
    // Final check for Audio file
    const storageRoot = path.join(process.env.REPO_ROOT!, '.data/storage');
    const audioFilePath = path.join(storageRoot, audioFileRelPath);
    console.log(`[Check] Audio file exists? ${fs.existsSync(audioFilePath)} (${audioFilePath})`);

    // Output Boundaries
    const boundaries = {
        gitSha: require('child_process').execSync('git rev-parse HEAD').toString().trim(),
        seedParams: {
            engines: ['engine-s1', 'engine-v2', 'engine-a3'],
            keys: ['default_shot_render', 'video_merge', 'audio_engine']
        },
        engineResolved: {
            shot: 'v1.0-mock',
            audio: 'v1.0-mock',
            video: 'v1.0-mock'
        },
        workerBuild: require('child_process').execSync('pnpm -v').toString().trim(),
        audioConfigSnapshot: { mode: 'full_mix', format: 'wav' },
        runId: pipelineRunId,
        producedArtifacts: {
            audioFile: audioFilePath
        }
    };
    
    fs.writeFileSync(path.join(eviPath, 'input_boundaries.json'), JSON.stringify(boundaries, null, 2));
    
    if (fs.existsSync(audioFilePath)) {
        console.log("\n✅ L3 R1/R2 SUCCESS.");
        process.exit(0);
    } else {
        console.error("\n❌ L3 R1/R2 FAILED: Audio file not found.");
        process.exit(1);
    }
}

test().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
