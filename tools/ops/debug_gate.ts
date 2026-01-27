import { ApiClient } from '../../apps/workers/src/api-client';
import { PrismaClient } from 'database';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();
const apiClient = new ApiClient(
    'http://127.0.0.1:3000',
    'dev-worker-key',
    'dev-worker-secret',
    'local-worker'
);

async function test() {
    console.log("--- TRIGGERING STAGE 1 PIPELINE ---");
    const pipelineRes = await (apiClient as any).request('POST', '/api/orchestrator/pipeline/stage1', {
        novelText: "Testing Orchestrator V2 with Audio Integration. Terminal Diagnostics.",
    });
    console.log("Response:", JSON.stringify(pipelineRes));

    if (!pipelineRes.success) throw new Error("Trigger failed");

    const pipelineRunId = pipelineRes.data.pipelineRunId;
    console.log("Waiting for pipelineRunId:", pipelineRunId);

    const maxWait = 180000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        const videoJob = await prisma.shotJob.findFirst({
            where: {
                type: 'VIDEO_RENDER',
                payload: { path: ['pipelineRunId'], equals: pipelineRunId }
            }
        });
        console.log(`Job status: ${videoJob?.status || 'PENDING'}`);
        if (videoJob?.status === 'SUCCEEDED') {
            console.log("SUCCESS! Writing manifest...");
            fs.writeFileSync('l3_terminal_pass.json', JSON.stringify(videoJob, null, 2));
            return;
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error("Timeout");
}

test().catch(e => { console.error(e); process.exit(1); });
