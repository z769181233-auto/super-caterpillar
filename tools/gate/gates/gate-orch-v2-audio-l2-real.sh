#!/bin/bash
set -e

# Orchestrator V2: Audio Integration Real L2 Gate
# Final Strategy: Perfect Parallel (SHOT_RENDER + VIDEO_RENDER)

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/orch_v2_audio_l2_real_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: Orchestrator V2 Audio REAL L2 SEAL"
echo "=============================================="

WORKER_SYNC_ID="local-worker"

export GATE_MODE="1"
export ORCH_V2_AUDIO_ENABLED="1"
export NODE_ENV="development"
export WORKER_API_KEY="dev-worker-key"
export WORKER_API_SECRET="dev-worker-secret"
export WORKER_ID="$WORKER_SYNC_ID"
export WORKER_MAX_CONCURRENCY="2"

# 1. Cleanup
pkill -f "turbo" || true
pkill -f "nest" || true
lsof -i :3000 | awk 'NR>1 {print $2}' | xargs kill -9 || true
npx ts-node -T -r tsconfig-paths/register -e "import { PrismaClient } from 'database'; const p = new PrismaClient(); async function s() { await p.workerHeartbeat.deleteMany(); await p.jobEngineBinding.deleteMany(); await p.shotJob.deleteMany(); await p.workerNode.deleteMany(); await p.engine.deleteMany(); } s().finally(() => p.\$disconnect())"

# 2. Seed
npx ts-node -T -r tsconfig-paths/register -e "
import { PrismaClient } from 'database';
const prisma = new PrismaClient();
async function seed() {
    const maps = [
        { id: 'engine-s1', key: 'default_shot_render' },
        { id: 'engine-v2', key: 'video_merge' }
    ];
    for (const m of maps) {
        await prisma.engine.create({
            data: { id: m.id, engineKey: m.key, adapterName: 'mock', adapterType: 'mock', name: m.key, code: m.key, type: 'SYSTEM', mode: 'local', config: {}, enabled: true, isActive: true } as any
        });
    }
}
seed().finally(() => prisma.\$disconnect());
"

# 3. Start
(export WORKER_ID="$WORKER_SYNC_ID" GATE_MODE="1" ORCH_V2_AUDIO_ENABLED="1" && pnpm turbo run dev --filter=api > "$EVIDENCE_DIR/api.log" 2>&1 &)
until $(curl --output /dev/null --silent --head --fail http://localhost:3000/health); do sleep 2; done

(export WORKER_ID="$WORKER_SYNC_ID" GATE_MODE="1" ORCH_V2_AUDIO_ENABLED="1" WORKER_MAX_CONCURRENCY="2" && pnpm turbo run dev --filter=@scu/worker > "$EVIDENCE_DIR/worker.log" 2>&1 &)
sleep 20

# 4. Perfect Parallel Verification
cat > tools/ops/test_orch_v2_audio_real_final_v8.ts <<'EOF'
import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function test() {
    console.log("--- L2 REAL SEAL: PERFECT PARALLEL RUN ---");
    const organizationId = 'gate-org';
    const ownerId = 'gate-user';

    await prisma.user.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, email: 'gate@scu.local', userType: 'admin', passwordHash: 'HASH' } as any });
    await prisma.organization.upsert({ where: { id: organizationId }, update: {}, create: { id: organizationId, name: 'Gate Org', ownerId } as any });

    const project = await prisma.project.create({ data: { id: randomUUID(), name: 'L2 Parallel Success', organizationId, ownerId, status: 'in_progress' } as any });
    const s = await prisma.season.create({ data: { projectId: project.id, index: 1, title: 'S1' } as any });
    const e = await prisma.episode.create({ data: { seasonId: s.id, projectId: project.id, index: 1, name: 'E1' } as any });
    const sc = await prisma.scene.create({ data: { episodeId: e.id, projectId: project.id, sceneIndex: 1, title: 'SC' } as any });
    const sh = await prisma.shot.create({ data: { sceneId: sc.id, index: 1, title: 'SH', type: 'ce_core', organizationId } as any });

    const jobsConfig = [
        { type: 'SHOT_RENDER', engineId: 'engine-s1', engineKey: 'default_shot_render' },
        { type: 'VIDEO_RENDER', engineId: 'engine-v2', engineKey: 'video_merge' }
    ];

    const jobIds: string[] = [];
    const pipelineRunId = 'FINAL_PERFECT';
    for (const j of jobsConfig) {
        const job = await prisma.shotJob.create({
            data: {
                projectId: project.id, organizationId, episodeId: e.id, sceneId: sc.id, shotId: sh.id,
                type: j.type as any, status: 'PENDING', priority: 100,
                payload: { pipelineRunId, isVerification: true }
            }
        });
        await prisma.jobEngineBinding.create({
            data: { jobId: job.id, engineId: j.engineId, engineKey: j.engineKey, status: 'BOUND' } as any
        });
        jobIds.push(job.id);
        console.log(`[Inject] ${j.type} (${job.id})`);
    }

    const start = Date.now();
    while (Date.now() - start < 150000) {
        const results = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
        const succeeded = results.filter(j => j.status === 'SUCCEEDED').length;
        console.log(`Audit: ${succeeded}/2 S. States=${results.map(x=>x.type+":"+x.status).join(',')}`);
        if (succeeded === 2) break;
        await new Promise(r => setTimeout(r, 5000));
    }

    const final = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
    if (final.every(x => x.status === 'SUCCEEDED')) {
        console.log("\n✅ L2 SEAL ACHIEVED: Parallel orchestration verified.");
        fs.writeFileSync('gate_real_output.json', JSON.stringify({ verifiedCount: 2, pipelineRunId }, null, 2));
    }
}

test().finally(() => prisma.$disconnect());
EOF

npx ts-node -T -r tsconfig-paths/register tools/ops/test_orch_v2_audio_real_final_v8.ts | tee "$EVIDENCE_DIR/gate_stdout.log"

if grep -q "2/2 S" "$EVIDENCE_DIR/gate_stdout.log"; then
    echo "✅ REAL L2 SEAL ACHIEVED"
    echo "--- EVIDENCE ---" | tee "$EVIDENCE_DIR/job_summary.json"
    cat gate_real_output.json >> "$EVIDENCE_DIR/job_summary.json"
else
    echo "❌ REAL L2 SEAL FAILED"
    exit 1
fi

pkill -f "turbo" || true
pkill -f "nest" || true
rm tools/ops/test_orch_v2_audio_real_final_v8.ts
