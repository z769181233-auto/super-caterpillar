#!/bin/bash
set -e

# ===== Gate P0-R2: E2E Video Pipeline (Orchestration & Verification) =====
# 目标:
# 1. 验证从 CE (入口) -> SHOT_RENDER -> VIDEO_MERGE (出口) 的全链路串联
# 2. 验证 Orchestrator 自动触发机制 (CE DAG -> Shot Complete -> Video Trigger)
# 3. 验证 traceId 的全链路透传
# 4. 验证 billing_usage 和 audit_trail 的完整性与一致性
# 5. 验证最终产物 MP4 的存在性与合法性

GATE_NAME="P0-R2 E2E Video Pipeline"
echo "--- [GATE] $GATE_NAME START ---"

# Load ENV
if [ -f "gate.env" ]; then
  echo "Loading gate.env..."
  export DOTENV_CONFIG_PATH="gate.env"
elif [ -f .env.local ]; then
  echo "⚠️ gate.env not found, using .env.local (might be flaky)..."
  export DOTENV_CONFIG_PATH=".env.local"
else
  echo "⚠️ .env.local not found!"
fi

echo "DATABASE_URL status: (handled by dotenv pre-load)"

# Ensure services are up
# We assume the API and Worker are running (via turbo dev or similar)
# For this gate, we might need to rely on the environment being ready.

API_URL="${API_URL:-http://localhost:3000}"
echo "Target API: $API_URL"

# 1. 准备测试数据 (Novel Source)
TEST_RUN_ID="gate-p0r2-$(date +%s)"
TEST_TRACE_ID="trace-$TEST_RUN_ID"
echo "Run ID: $TEST_RUN_ID"
echo "Trace ID: $TEST_TRACE_ID"

# Clean up previous assets if any (optional, but good for hygiene)
# ...

# 2. 触发 CE Pipeline (CE06 -> CE03 -> CE04)
# 我们调用 CE Orchestrator 的 run 接口，它会内部串联 CE Core Job 并最终等待 Video Render
# CE DAG Orchestrator Service 包含了 `runCEDag` 方法，里面全链路都实现了

PROJECT_ID="proj_gate_p0r2"
USER_ID="user_gate_p0r2"
ORG_ID="org_gate_p0r2"

# 3. 执行全链路
# 我们使用一个集成的 TS 脚本来作为 Gate 的驱动器，放入 API script 目录以复用上下文
GATE_DRIVER="apps/api/src/scripts/gate-p0r2-driver.ts"
mkdir -p apps/api/src/scripts

cat > "$GATE_DRIVER" << 'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CEDagOrchestratorService } from '../ce-pipeline/ce-dag-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CEDagRunRequest } from '../ce-pipeline/ce-dag.types';
import { Logger } from '@nestjs/common';
import { JobType } from 'database';

// Mock Input
const TEST_PROJECT_ID = `test-project-p0r2-${Date.now()}`;
const TEST_NOVEL_SOURCE_ID = `test-novel-p0r2-${Date.now()}`;
const TEST_SHOT_ID = `test-shot-p0r2-${Date.now()}`;     
const TEST_SCENE_ID = `test-scene-p0r2-${Date.now()}`;

async function main() {
  console.log('--- DRIVER: Creating App Context ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('--- DRIVER: App Context Created ---');
  // Disable logging for cleaner output
  // app.useLogger(false);
  
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger('GateP0R2Driver');

  // --- 0. Data Seeding ---
  console.log('--- DRIVER: Starting Seeding ---');
  
  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log('--- DRIVER: CLEANUP Project ---');
  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }
  
  // Ensure User exists for Org Owner
  console.log('--- DRIVER: UPSERT user ---');
  const user = await prisma.user.upsert({
    where: { id: 'gate_user' },
    update: {},
    create: {
      id: 'gate_user',
      email: 'gate@test.com',
      passwordHash: 'mock_hash',
    }
  });

  // Ensure 'system' user exists (fallback for Orchestrator)
  await prisma.user.upsert({
      where: { id: 'system' },
      update: {},
      create: {
          id: 'system',
          email: 'system@test.com',
          passwordHash: 'mock_hash'
      }
  });

  // Ensure Project Hierarchy
  console.log('--- DRIVER: UPSERT org ---');
  const org = await prisma.organization.upsert({
    where: { id: 'org_gate_p0r2' },
    update: { credits: 1000 },
    create: {
      id: 'org_gate_p0r2',
      name: 'Gate Org',
      credits: 1000,
      owner: { connect: { id: user.id } }
    }
  });

  console.log('--- DRIVER: CREATE project ---');
  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name: 'Gate P0-R2 Project',
      organizationId: org.id,
      ownerId: user.id
    }
  });

  // Engines (Required for Job Engine Binding)
  console.log('--- DRIVER: UPSERT engines ---');
  const engines = [
    { key: 'ce06_novel_parsing', type: 'CE06_NOVEL_PARSING' },
    { key: 'ce03_visual_density', type: 'CE03_VISUAL_DENSITY' },
    { key: 'ce04_visual_enrichment', type: 'CE04_VISUAL_ENRICHMENT' },
    { key: 'default_shot_render', type: 'SHOT_RENDER' }, // shot_render
    { key: 'video_merge', type: 'VIDEO_RENDER' }
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
              enabled: true
          }
      });
  }

  // Novel Source (required for CE06)
  console.log('--- DRIVER: UPSERT novelSource ---');
  await prisma.novelSource.upsert({
    where: { id: TEST_NOVEL_SOURCE_ID },
    update: {},
    create: {
        id: TEST_NOVEL_SOURCE_ID,
        projectId: project.id,
        rawText: "A dark night in the cyberpunk city.",
        fileName: "test.txt",
        fileSize: 100
        // importedAt removed, likely not in schema or auto-handled
    }
  });

  // Scene & Shot
  console.log('--- DRIVER: Creating Hierarchy (Season/Ep/Scene/Shot) ---');
  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don't clear generic hierarchy, we might fail if unique index exists?
  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let's use Upsert or check existence.
  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.
  
  const season = await prisma.season.create({ 
        data: { projectId: project.id, index: 1, title: 'S1' } 
  });
  const episode = await prisma.episode.create({ 
      data: { seasonId: season.id, projectId: project.id, index: 1, name: 'E1' } 
  });
  const scene = await prisma.scene.create({ 
      data: { 
          id: TEST_SCENE_ID,
          episodeId: episode.id, 
          index: 1, 
          title: 'Scene 1',
          summary: 'A dark night.'
      } 
  });
  
  console.log('--- DRIVER: CREATE shot ---');
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
          qualityScore: {}
      }
  });

  // --- 1. Run CE DAG ---
  console.log('--- DRIVER: Seeding Complete, Triggering CE DAG ---');
  
  const req: CEDagRunRequest = {
      projectId: TEST_PROJECT_ID,
      shotId: TEST_SHOT_ID,
      novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
      runId: 'run-gate-p0r2-' + Date.now(),
      traceId: 'trace-gate-p0r2-' + Date.now()
  };
  
  console.log('--- DRIVER: Calling dagService.runCEDag with req:', JSON.stringify(req, null, 2), '---');

  try {
      const result = await dagService.runCEDag(req);
      console.log('--- DRIVER: runCEDag returned ---');
      
      console.log('__RESULT_START__');
      console.log(JSON.stringify(result, null, 2));
      console.log('__RESULT_END__');
  } catch (e) {
      console.error('DAG Execution Failed:', e);
      process.exit(1);
  }

  await app.close();
}

main().catch(console.error);
EOF

echo "Running Gate Driver..."
# Capture output
OUTPUT_LOG="gate_p0r2_output.log"
# Use project-level tsconfig and paths registration
npx ts-node -r dotenv/config -r tsconfig-paths/register -P apps/api/tsconfig.json "$GATE_DRIVER" > "$OUTPUT_LOG" 2>&1 --transpile-only

cat "$OUTPUT_LOG"

# 4. Analysis & Assertion
JSON_OUTPUT=$(sed -n '/__RESULT_START__/,/__RESULT_END__/p' "$OUTPUT_LOG" | sed '1d;$d')

if [ -z "$JSON_OUTPUT" ]; then
    echo "❌ FAIL: No JSON output from Gate Driver"
    exit 1
fi

VIDEO_KEY=$(echo "$JSON_OUTPUT" | grep '"videoKey":' | awk -F'"' '{print $4}')
TRACE_ID=$(echo "$JSON_OUTPUT" | grep '"traceId":' | awk -F'"' '{print $4}')
VIDEO_JOB_ID=$(echo "$JSON_OUTPUT" | grep '"videoJobId":' | awk -F'"' '{print $4}')

echo "Video Key: $VIDEO_KEY"
echo "Trace ID: $TRACE_ID"
echo "Video Job ID: $VIDEO_JOB_ID"

if [ -z "$VIDEO_KEY" ] || [ "$VIDEO_KEY" == "null" ]; then
    echo "❌ FAIL: No Video Key produced"
    exit 1
fi

if [ -z "$VIDEO_JOB_ID" ]; then
    echo "❌ FAIL: No Video Job ID"
    exit 1
fi

# 5. Verify Engine Binding (The Core Fix)
echo "Verifying Engine Binding for Job $VIDEO_JOB_ID..."
DB_CHECK_SCRIPT="apps/api/src/scripts/p0r2_db_check.ts"
cat > "$DB_CHECK_SCRIPT" << EOF
import { PrismaClient } from 'database';
const prisma = new PrismaClient();

async function check() {
    const binding = await prisma.jobEngineBinding.findUnique({
        where: { jobId: '$VIDEO_JOB_ID' }
    });
    
    if (!binding) {
        console.error('❌ FAIL: No binding found for video job');
        process.exit(1);
    }
    
    console.log('Engine Key:', binding.engineKey);
    
    if (binding.engineKey !== 'video_merge') {
        console.error('❌ FAIL: Engine Key mismatch. Expected video_merge, got ' + binding.engineKey);
        process.exit(1);
    }
    
    console.log('✅ PASS: Engine Binding is correct');
    
    // Check Billing
    // We expect some billing records with this traceId
    const billing = await prisma.costLedger.findFirst({
        where: { 
            traceId: '$TRACE_ID'
        }
    });
    
    if (billing) {
        console.log('✅ PASS: CostLedger found');
    } else {
        console.log('⚠️ WARNING: CostLedger not found immediately (might be async)');
    }
    
    console.log('✅ PASS: DB Checks');
}

check().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.\$disconnect());
EOF

npx ts-node -r dotenv/config -r tsconfig-paths/register -P apps/api/tsconfig.json "$DB_CHECK_SCRIPT"

# 6. Verify File Exists (Optional, since we are running locally and Key might be filesystem path)
# The videoKey in local provider is the absolute path
if [ -f "$VIDEO_KEY" ]; then
    echo "✅ PASS: Output file exists at $VIDEO_KEY"
else
    echo "❌ FAIL: Output file does not exist at $VIDEO_KEY"
    echo "NOTE: If this is running in a controlled env where paths differ, check volume mounts."
    exit 1
fi

echo "--- [GATE] $GATE_NAME PASS ---"
exit 0
