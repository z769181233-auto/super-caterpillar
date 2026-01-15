#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

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
# CE DAG Orchestrator Service 包含了 $(runCEDag) 方法，里面全链路都实现了

PROJECT_ID="proj_gate_p0r2"
USER_ID="user_gate_p0r2"
ORG_ID="org_gate_p0r2"

# 3. 执行全链路
# 我们使用一个集成的 TS 脚本来作为 Gate 的驱动器，放入 API script 目录以复用上下文
GATE_DRIVER="apps/api/src/scripts/gate-p0r2-driver.ts"
mkdir -p apps/api/src/scripts

cat > "$GATE_DRIVER" << import { NestFactory } from import { AppModule } from import { CEDagOrchestratorService } from import { PrismaService } from import { JobService } from import { CEDagRunRequest } from import { Logger } from import { JobType } from 
// Mock Input
const TEST_PROJECT_ID = $(test-project-p0r2-${Date.now()});
const TEST_NOVEL_SOURCE_ID = $(test-novel-p0r2-${Date.now()});
const TEST_SHOT_ID = $(test-shot-p0r2-${Date.now()});     
const TEST_SCENE_ID = $(test-scene-p0r2-${Date.now()});

async function main() {
  console.log(  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(  // Disable logging for cleaner output
  // app.useLogger(false);
  
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger(
  // --- 0. Data Seeding ---
  console.log(  
  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log(  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }
  
  // Ensure User exists for Org Owner
  console.log(  const user = await prisma.user.upsert({
    where: { id:     update: {},
    create: {
      id:       email:       passwordHash:     }
  });

  // Ensure   await prisma.user.upsert({
      where: { id:       update: {},
      create: {
          id:           email:           passwordHash:       }
  });

  // Ensure Project Hierarchy
  console.log(  const org = await prisma.organization.upsert({
    where: { id:     update: { credits: 1000 },
    create: {
      id:       name:       credits: 1000,
      owner: { connect: { id: user.id } }
    }
  });

  console.log(  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name:       organizationId: org.id,
      ownerId: user.id
    }
  });

  // Engines (Required for Job Engine Binding)
  console.log(  const engines = [
    { key:     { key:     { key:     { key:     { key:   ];

  for (const eng of engines) {
      await prisma.engine.upsert({
          where: { code: eng.key },
          update: { isActive: true, enabled: true },
          create: {
              engineKey: eng.key,
              code: eng.key,
              name: eng.key,
              type: eng.type,
              adapterName:               adapterType:               config: {},
              isActive: true,
              enabled: true
          }
      });
  }

  // Novel Source (required for CE06)
  console.log(  await prisma.novelSource.upsert({
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
  console.log(  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.
  
  const season = await prisma.season.create({ 
        data: { projectId: project.id, index: 1, title:   });
  const episode = await prisma.episode.create({ 
      data: { seasonId: season.id, projectId: project.id, index: 1, name:   });
  const scene = await prisma.scene.create({ 
      data: { 
          id: TEST_SCENE_ID,
          episodeId: episode.id, 
          index: 1, 
          title:           summary:       } 
  });
  
  console.log(  const shot = await prisma.shot.create({
      data: {
          id: TEST_SHOT_ID,
          sceneId: scene.id,
          organizationId: org.id,
          index: 1,
          title:           description:           type:           params: {},
          qualityScore: {}
      }
  });

  // --- 1. Run CE DAG ---
  console.log(  
  const req: CEDagRunRequest = {
      projectId: TEST_PROJECT_ID,
      shotId: TEST_SHOT_ID,
      novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
      runId:       traceId:   };
  
  console.log(
  try {
      const result = await dagService.runCEDag(req);
      console.log(      
      console.log(      console.log(JSON.stringify(result, null, 2));
      console.log(  } catch (e) {
      console.error(      process.exit(1);
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
JSON_OUTPUT=$(sed -n 
if [ -z "$JSON_OUTPUT" ]; then
    echo "❌ FAIL: No JSON output from Gate Driver"
    exit 1
fi

VIDEO_KEY=$(echo "$JSON_OUTPUT" | grep TRACE_ID=$(echo "$JSON_OUTPUT" | grep VIDEO_JOB_ID=$(echo "$JSON_OUTPUT" | grep 
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
import { PrismaClient } from const prisma = new PrismaClient();

async function check() {
    const binding = await prisma.jobEngineBinding.findUnique({
        where: { jobId:     });
    
    if (!binding) {
        console.error(        process.exit(1);
    }
    
    console.log(    
    if (binding.engineKey !==         console.error(        process.exit(1);
    }
    
    console.log(    
    // Check Billing
    // We expect some billing records with this traceId
    const billing = await prisma.costLedger.findFirst({
        where: { 
            traceId:         }
    });
    
    if (billing) {
        console.log(    } else {
        console.log(    }
    
    console.log(}

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
# CE DAG Orchestrator Service 包含了 $(runCEDag) 方法，里面全链路都实现了

PROJECT_ID="proj_gate_p0r2"
USER_ID="user_gate_p0r2"
ORG_ID="org_gate_p0r2"

# 3. 执行全链路
# 我们使用一个集成的 TS 脚本来作为 Gate 的驱动器，放入 API script 目录以复用上下文
GATE_DRIVER="apps/api/src/scripts/gate-p0r2-driver.ts"
mkdir -p apps/api/src/scripts

cat > "$GATE_DRIVER" << import { NestFactory } from import { AppModule } from import { CEDagOrchestratorService } from import { PrismaService } from import { JobService } from import { CEDagRunRequest } from import { Logger } from import { JobType } from 
// Mock Input
const TEST_PROJECT_ID = $(test-project-p0r2-${Date.now()});
const TEST_NOVEL_SOURCE_ID = $(test-novel-p0r2-${Date.now()});
const TEST_SHOT_ID = $(test-shot-p0r2-${Date.now()});     
const TEST_SCENE_ID = $(test-scene-p0r2-${Date.now()});

async function main() {
  console.log(  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(  // Disable logging for cleaner output
  // app.useLogger(false);
  
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger(
  // --- 0. Data Seeding ---
  console.log(  
  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log(  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }
  
  // Ensure User exists for Org Owner
  console.log(  const user = await prisma.user.upsert({
    where: { id:     update: {},
    create: {
      id:       email:       passwordHash:     }
  });

  // Ensure   await prisma.user.upsert({
      where: { id:       update: {},
      create: {
          id:           email:           passwordHash:       }
  });

  // Ensure Project Hierarchy
  console.log(  const org = await prisma.organization.upsert({
    where: { id:     update: { credits: 1000 },
    create: {
      id:       name:       credits: 1000,
      owner: { connect: { id: user.id } }
    }
  });

  console.log(  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name:       organizationId: org.id,
      ownerId: user.id
    }
  });

  // Engines (Required for Job Engine Binding)
  console.log(  const engines = [
    { key:     { key:     { key:     { key:     { key:   ];

  for (const eng of engines) {
      await prisma.engine.upsert({
          where: { code: eng.key },
          update: { isActive: true, enabled: true },
          create: {
              engineKey: eng.key,
              code: eng.key,
              name: eng.key,
              type: eng.type,
              adapterName:               adapterType:               config: {},
              isActive: true,
              enabled: true
          }
      });
  }

  // Novel Source (required for CE06)
  console.log(  await prisma.novelSource.upsert({
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
  console.log(  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.
  
  const season = await prisma.season.create({ 
        data: { projectId: project.id, index: 1, title:   });
  const episode = await prisma.episode.create({ 
      data: { seasonId: season.id, projectId: project.id, index: 1, name:   });
  const scene = await prisma.scene.create({ 
      data: { 
          id: TEST_SCENE_ID,
          episodeId: episode.id, 
          index: 1, 
          title:           summary:       } 
  });
  
  console.log(  const shot = await prisma.shot.create({
      data: {
          id: TEST_SHOT_ID,
          sceneId: scene.id,
          organizationId: org.id,
          index: 1,
          title:           description:           type:           params: {},
          qualityScore: {}
      }
  });

  // --- 1. Run CE DAG ---
  console.log(  
  const req: CEDagRunRequest = {
      projectId: TEST_PROJECT_ID,
      shotId: TEST_SHOT_ID,
      novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
      runId:       traceId:   };
  
  console.log(
  try {
      const result = await dagService.runCEDag(req);
      console.log(      
      console.log(      console.log(JSON.stringify(result, null, 2));
      console.log(  } catch (e) {
      console.error(      process.exit(1);
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
JSON_OUTPUT=$(sed -n 
if [ -z "$JSON_OUTPUT" ]; then
    echo "❌ FAIL: No JSON output from Gate Driver"
    exit 1
fi

VIDEO_KEY=$(echo "$JSON_OUTPUT" | grep TRACE_ID=$(echo "$JSON_OUTPUT" | grep VIDEO_JOB_ID=$(echo "$JSON_OUTPUT" | grep 
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
import { PrismaClient } from const prisma = new PrismaClient();

async function check() {
    const binding = await prisma.jobEngineBinding.findUnique({
        where: { jobId:     });
    
    if (!binding) {
        console.error(        process.exit(1);
    }
    
    console.log(    
    if (binding.engineKey !==         console.error(        process.exit(1);
    }
    
    console.log(    
    // Check Billing
    // We expect some billing records with this traceId
    const billing = await prisma.costLedger.findFirst({
        where: { 
            traceId:         }
    });
    
    if (billing) {
        console.log(    } else {
        console.log(    }
    
    console.log(}

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
# CE DAG Orchestrator Service 包含了 $(runCEDag) 方法，里面全链路都实现了

PROJECT_ID="proj_gate_p0r2"
USER_ID="user_gate_p0r2"
ORG_ID="org_gate_p0r2"

# 3. 执行全链路
# 我们使用一个集成的 TS 脚本来作为 Gate 的驱动器，放入 API script 目录以复用上下文
GATE_DRIVER="apps/api/src/scripts/gate-p0r2-driver.ts"
mkdir -p apps/api/src/scripts

cat > "$GATE_DRIVER" << import { NestFactory } from import { AppModule } from import { CEDagOrchestratorService } from import { PrismaService } from import { JobService } from import { CEDagRunRequest } from import { Logger } from import { JobType } from 
// Mock Input
const TEST_PROJECT_ID = $(test-project-p0r2-${Date.now()});
const TEST_NOVEL_SOURCE_ID = $(test-novel-p0r2-${Date.now()});
const TEST_SHOT_ID = $(test-shot-p0r2-${Date.now()});     
const TEST_SCENE_ID = $(test-scene-p0r2-${Date.now()});

async function main() {
  console.log(  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(  // Disable logging for cleaner output
  // app.useLogger(false);
  
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger(
  // --- 0. Data Seeding ---
  console.log(  
  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log(  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }
  
  // Ensure User exists for Org Owner
  console.log(  const user = await prisma.user.upsert({
    where: { id:     update: {},
    create: {
      id:       email:       passwordHash:     }
  });

  // Ensure   await prisma.user.upsert({
      where: { id:       update: {},
      create: {
          id:           email:           passwordHash:       }
  });

  // Ensure Project Hierarchy
  console.log(  const org = await prisma.organization.upsert({
    where: { id:     update: { credits: 1000 },
    create: {
      id:       name:       credits: 1000,
      owner: { connect: { id: user.id } }
    }
  });

  console.log(  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name:       organizationId: org.id,
      ownerId: user.id
    }
  });

  // Engines (Required for Job Engine Binding)
  console.log(  const engines = [
    { key:     { key:     { key:     { key:     { key:   ];

  for (const eng of engines) {
      await prisma.engine.upsert({
          where: { code: eng.key },
          update: { isActive: true, enabled: true },
          create: {
              engineKey: eng.key,
              code: eng.key,
              name: eng.key,
              type: eng.type,
              adapterName:               adapterType:               config: {},
              isActive: true,
              enabled: true
          }
      });
  }

  // Novel Source (required for CE06)
  console.log(  await prisma.novelSource.upsert({
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
  console.log(  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.
  
  const season = await prisma.season.create({ 
        data: { projectId: project.id, index: 1, title:   });
  const episode = await prisma.episode.create({ 
      data: { seasonId: season.id, projectId: project.id, index: 1, name:   });
  const scene = await prisma.scene.create({ 
      data: { 
          id: TEST_SCENE_ID,
          episodeId: episode.id, 
          index: 1, 
          title:           summary:       } 
  });
  
  console.log(  const shot = await prisma.shot.create({
      data: {
          id: TEST_SHOT_ID,
          sceneId: scene.id,
          organizationId: org.id,
          index: 1,
          title:           description:           type:           params: {},
          qualityScore: {}
      }
  });

  // --- 1. Run CE DAG ---
  console.log(  
  const req: CEDagRunRequest = {
      projectId: TEST_PROJECT_ID,
      shotId: TEST_SHOT_ID,
      novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
      runId:       traceId:   };
  
  console.log(
  try {
      const result = await dagService.runCEDag(req);
      console.log(      
      console.log(      console.log(JSON.stringify(result, null, 2));
      console.log(  } catch (e) {
      console.error(      process.exit(1);
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
JSON_OUTPUT=$(sed -n 
if [ -z "$JSON_OUTPUT" ]; then
    echo "❌ FAIL: No JSON output from Gate Driver"
    exit 1
fi

VIDEO_KEY=$(echo "$JSON_OUTPUT" | grep TRACE_ID=$(echo "$JSON_OUTPUT" | grep VIDEO_JOB_ID=$(echo "$JSON_OUTPUT" | grep 
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
import { PrismaClient } from const prisma = new PrismaClient();

async function check() {
    const binding = await prisma.jobEngineBinding.findUnique({
        where: { jobId:     });
    
    if (!binding) {
        console.error(        process.exit(1);
    }
    
    console.log(    
    if (binding.engineKey !==         console.error(        process.exit(1);
    }
    
    console.log(    
    // Check Billing
    // We expect some billing records with this traceId
    const billing = await prisma.costLedger.findFirst({
        where: { 
            traceId:         }
    });
    
    if (billing) {
        console.log(    } else {
        console.log(    }
    
    console.log(}

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
# CE DAG Orchestrator Service 包含了 $(runCEDag) 方法，里面全链路都实现了

PROJECT_ID="proj_gate_p0r2"
USER_ID="user_gate_p0r2"
ORG_ID="org_gate_p0r2"

# 3. 执行全链路
# 我们使用一个集成的 TS 脚本来作为 Gate 的驱动器，放入 API script 目录以复用上下文
GATE_DRIVER="apps/api/src/scripts/gate-p0r2-driver.ts"
mkdir -p apps/api/src/scripts

cat > "$GATE_DRIVER" << import { NestFactory } from import { AppModule } from import { CEDagOrchestratorService } from import { PrismaService } from import { JobService } from import { CEDagRunRequest } from import { Logger } from import { JobType } from 
// Mock Input
const TEST_PROJECT_ID = $(test-project-p0r2-${Date.now()});
const TEST_NOVEL_SOURCE_ID = $(test-novel-p0r2-${Date.now()});
const TEST_SHOT_ID = $(test-shot-p0r2-${Date.now()});     
const TEST_SCENE_ID = $(test-scene-p0r2-${Date.now()});

async function main() {
  console.log(  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(  // Disable logging for cleaner output
  // app.useLogger(false);
  
  const prisma = app.get(PrismaService);
  const dagService = app.get(CEDagOrchestratorService);
  const logger = new Logger(
  // --- 0. Data Seeding ---
  console.log(  
  // Clean up Project (cascades to Season, Episode, Scene, Shot, ShotJob, Asset)
  console.log(  try {
    await prisma.project.delete({ where: { id: TEST_PROJECT_ID } });
  } catch (e) {
    // Ignore if not found
  }
  
  // Ensure User exists for Org Owner
  console.log(  const user = await prisma.user.upsert({
    where: { id:     update: {},
    create: {
      id:       email:       passwordHash:     }
  });

  // Ensure   await prisma.user.upsert({
      where: { id:       update: {},
      create: {
          id:           email:           passwordHash:       }
  });

  // Ensure Project Hierarchy
  console.log(  const org = await prisma.organization.upsert({
    where: { id:     update: { credits: 1000 },
    create: {
      id:       name:       credits: 1000,
      owner: { connect: { id: user.id } }
    }
  });

  console.log(  const project = await prisma.project.upsert({
    where: { id: TEST_PROJECT_ID },
    update: {},
    create: {
      id: TEST_PROJECT_ID,
      name:       organizationId: org.id,
      ownerId: user.id
    }
  });

  // Engines (Required for Job Engine Binding)
  console.log(  const engines = [
    { key:     { key:     { key:     { key:     { key:   ];

  for (const eng of engines) {
      await prisma.engine.upsert({
          where: { code: eng.key },
          update: { isActive: true, enabled: true },
          create: {
              engineKey: eng.key,
              code: eng.key,
              name: eng.key,
              type: eng.type,
              adapterName:               adapterType:               config: {},
              isActive: true,
              enabled: true
          }
      });
  }

  // Novel Source (required for CE06)
  console.log(  await prisma.novelSource.upsert({
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
  console.log(  // Need to handle potential existing hierarchy to avoid unique constraints if run multiple times?
  // Since we don  // Upsert is safer. But create is fine if we use random IDs or delete first.
  // We use fixed IDs.
  // Let  // Actually, for Seasons/Episodes/Scene/Shot, better to cleanup first or use Upsert.
  // I will use Upsert for robustness.
  
  const season = await prisma.season.create({ 
        data: { projectId: project.id, index: 1, title:   });
  const episode = await prisma.episode.create({ 
      data: { seasonId: season.id, projectId: project.id, index: 1, name:   });
  const scene = await prisma.scene.create({ 
      data: { 
          id: TEST_SCENE_ID,
          episodeId: episode.id, 
          index: 1, 
          title:           summary:       } 
  });
  
  console.log(  const shot = await prisma.shot.create({
      data: {
          id: TEST_SHOT_ID,
          sceneId: scene.id,
          organizationId: org.id,
          index: 1,
          title:           description:           type:           params: {},
          qualityScore: {}
      }
  });

  // --- 1. Run CE DAG ---
  console.log(  
  const req: CEDagRunRequest = {
      projectId: TEST_PROJECT_ID,
      shotId: TEST_SHOT_ID,
      novelSourceId: TEST_NOVEL_SOURCE_ID, // Fix: Pass novelSourceId
      runId:       traceId:   };
  
  console.log(
  try {
      const result = await dagService.runCEDag(req);
      console.log(      
      console.log(      console.log(JSON.stringify(result, null, 2));
      console.log(  } catch (e) {
      console.error(      process.exit(1);
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
JSON_OUTPUT=$(sed -n 
if [ -z "$JSON_OUTPUT" ]; then
    echo "❌ FAIL: No JSON output from Gate Driver"
    exit 1
fi

VIDEO_KEY=$(echo "$JSON_OUTPUT" | grep TRACE_ID=$(echo "$JSON_OUTPUT" | grep VIDEO_JOB_ID=$(echo "$JSON_OUTPUT" | grep 
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
import { PrismaClient } from const prisma = new PrismaClient();

async function check() {
    const binding = await prisma.jobEngineBinding.findUnique({
        where: { jobId:     });
    
    if (!binding) {
        console.error(        process.exit(1);
    }
    
    console.log(    
    if (binding.engineKey !==         console.error(        process.exit(1);
    }
    
    console.log(    
    // Check Billing
    // We expect some billing records with this traceId
    const billing = await prisma.costLedger.findFirst({
        where: { 
            traceId:         }
    });
    
    if (billing) {
        console.log(    } else {
        console.log(    }
    
    console.log(}

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
