import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { EngineRegistry } from '../apps/api/src/engine/engine-registry.service';
import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { JobType, JobStatus } from 'database';
import * as crypto from 'crypto';
import * as path from 'path';

async function run() {
    console.log('🚀 Starting HEADLESS FULL-CHAIN MINLOOP Verification');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const registry = app.get(EngineRegistry);
    const prisma = app.get(PrismaService);

    const traceId = `headless-fullchain-${crypto.randomBytes(4).toString('hex')}`;
    const projectId = `p-${crypto.randomBytes(4).toString('hex')}`;
    const userId = `u-${crypto.randomBytes(4).toString('hex')}`;
    const dummyAssetPath = path.resolve(process.cwd(), '.runtime/assets/dummy.png');

    console.log(`TraceId: ${traceId}`);

    try {
        await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email: `${userId}@sc.com`, passwordHash: 'noop', quota: { credits: 1000 } } });
        await prisma.organization.upsert({ where: { id: 'default-org' }, update: {}, create: { id: 'default-org', name: 'Default', ownerId: userId } });
        await prisma.project.upsert({ where: { id: projectId }, update: {}, create: { id: projectId, name: 'FullChain', organizationId: 'default-org', ownerId: userId } });

        const enginesToInvoke = [
            { key: 'ce06_novel_parsing', payload: { rawText: 'Chapter 1: The beginning.' } },
            { key: 'dialogue_optimization', payload: { dialogue: 'Help me!', speaker: 'Hero' } },
            { key: 'emotion_analysis', payload: { text: 'Help me!' } },
            { key: 'ce03_visual_density', payload: { structured_text: 'Dense forest' } },
            { key: 'ce04_visual_enrichment', payload: { prompt: 'A girl in forest' } },
            { key: 'shot_preview', payload: { prompt: 'Cinematic shot' } },
            { key: 'character_gen', payload: { name: 'Hero', description: 'Brave' } },
            { key: 'scene_composition', payload: { background_url: `file://${dummyAssetPath}`, elements: [] } }
        ];

        console.log('--- STAGE 1: ENGINE SUITE INVOCATION ---');
        for (const item of enginesToInvoke) {
            const jobId = `job-${crypto.randomBytes(4).toString('hex')}`;
            console.log(`Checking Engine: ${item.key} (JobId: ${jobId})...`);

            await prisma.shotJob.create({
                data: {
                    type: 'CE06_NOVEL_PARSING' as any,
                    id: jobId,
                    organizationId: 'default-org',
                    projectId,
                    status: 'SUCCEEDED' as any,
                    payload: { test: true },
                    traceId,
                    attempts: 1
                }
            });

            const adapter = registry.getAdapter(item.key);
            if (!adapter) throw new Error(`Adapter missing for ${item.key}`);

            const res = await adapter.invoke({
                jobType: JobType.CE06_NOVEL_PARSING,
                payload: item.payload,
                context: { traceId, projectId, userId, organizationId: 'default-org', jobId, attempt: 1 } as any
            });

            if (res.status !== 'SUCCESS') {
                throw new Error(`Engine ${item.key} failed: ${JSON.stringify(res.error)}`);
            }
            console.log(`  [OK] ${item.key} status: ${res.status}`);
        }

        console.log('--- STAGE 2: QC DETERMINISTIC CHAIN ---');
        const qcEngines = [
            'qc01_visual_fidelity',
            'qc02_narrative_consistency',
            'qc03_identity_continuity',
            'qc04_compliance_scan'
        ];

        for (const key of qcEngines) {
            const jobId = `job-qc-${crypto.randomBytes(4).toString('hex')}`;
            console.log(`Checking QC: ${key} (JobId: ${jobId})...`);

            await prisma.shotJob.create({
                data: {
                    type: 'QC_CHECK' as any,
                    id: jobId,
                    organizationId: 'default-org',
                    projectId,
                    status: 'SUCCEEDED' as any,
                    payload: { test: true },
                    traceId,
                    attempts: 1
                }
            });

            const adapter = registry.getAdapter(key);
            const res = await adapter.invoke({
                jobType: JobType.QC_CHECK as any,
                payload: {
                    url: 'render_output.mp4',
                    storyBeat: 'Action',
                    dialogue: 'Go!',
                    characterId: 'char_valid_123'
                },
                context: { traceId, projectId, userId, organizationId: 'default-org', jobId, attempt: 1 } as any
            });

            if (res.status !== 'SUCCESS') throw new Error(`QC ${key} failed: ${JSON.stringify(res.error)}`);
            console.log(`  [OK] ${key} result: ${(res.output as any).status}`);
        }

        console.log('--- STAGE 3: AUDIT & COST INTEGRITY ---');
        const auditLogs = await prisma.auditLog.findMany({
            where: { details: { path: ['traceId'], equals: traceId } }
        });
        console.log(`✅ Audit Trails: ${auditLogs.length} found.`);

        const costLogs = await prisma.costLedger.findMany({
            where: { projectId }
        });
        console.log(`✅ Cost Records: ${costLogs.length} found.`);

        if (auditLogs.length === 0) throw new Error('AUDIT_CHAIN_MISSING');
        if (costLogs.length === 0) throw new Error('COST_CHAIN_MISSING');

        console.log('🎉 FULL-CHAIN MINLOOP PASSED SUCCESSFULLY!');
    } catch (err: any) {
        console.error('❌ Minloop Failed:', err.message);
        process.exit(1);
    } finally {
        await app.close();
    }
}

run();
