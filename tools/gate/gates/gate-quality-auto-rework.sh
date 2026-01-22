#!/bin/bash
set -e
# P13-3 Quality Scoring & Auto-Rework Sealing Gate (0-Risk Rev.)
# 验证：质量评分触发返工 -> 三道闸（Attempt, Idempotency, Budget）-> 封板级证据链

function log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
function log_success() { echo -e "\033[0;32m[PASS]\033[0m $1"; }
function log_fail() { echo -e "\033[0;31m[FAIL]\033[0m $1"; }
function log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

export GATE_NAME="quality_auto_rework"
export TS=$(date +%Y%m%d%H%M%S)
export TRACE_ID="quality_gate_$TS"
export API_URL=${API_URL:-"http://localhost:3000"}
export EVIDENCE_ROOT="docs/_evidence/quality_rework_$TS"

mkdir -p "$EVIDENCE_ROOT"
export LOG_FILE="$EVIDENCE_ROOT/GATE_RUN.log"

# 同时输出到控制台和日志文件
exec > >(tee -i "$LOG_FILE") 2>&1

log_info "Starting Quality Auto-Rework Sealing Gate v2 (P13-3)..."
log_info "TraceId: $TRACE_ID"

# 0. 准备环境 (User/Org)
log_info "Step 0: Seeding User and Organization..."
psql "$DATABASE_URL" -c "INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") VALUES ('gate-user', 'gate@scu.ai', 'hash', now(), now()) ON CONFLICT DO NOTHING"
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", credits) VALUES ('gate-org', 'Gate Org', 'gate-user', now(), now(), 1000) ON CONFLICT DO NOTHING"
# 确保初始 Credits 足够
psql "$DATABASE_URL" -c "UPDATE organizations SET credits = 1000 WHERE id = 'gate-org'"

# 1. 初始化数据 (Project/Season/Episode/Scene/Shot)
log_info "Step 1: Seeding test hierarchy..."
PROJECT_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'Quality Sealing Project $TRACE_ID', 'gate-user', 'gate-org', 'in_progress', now(), now()) RETURNING id" | head -n 1)
SEASON_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$PROJECT_ID', 1, 'Gate Season', now(), now()) RETURNING id" | head -n 1)
EPISODE_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (gen_random_uuid(), '$SEASON_ID', '$PROJECT_ID', 1, 'Gate Episode') RETURNING id" | head -n 1)
SCENE_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, created_at, updated_at) VALUES (gen_random_uuid(), '$EPISODE_ID', '$PROJECT_ID', 1, now(), now()) RETURNING id" | head -n 1)
SHOT_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", index, type) VALUES (gen_random_uuid(), '$SCENE_ID', 'gate-org', 1, 'SHOT_RENDER') RETURNING id" | head -n 1)

log_info "Seed hierarchy done. SHOT_ID=$SHOT_ID"

# 2. 场景 A: 失败触发返工 (FAIL -> REWORK)
log_info "Scenario A: Initial failure triggers rework..."
ANCHOR_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO identity_anchors (id, project_id, character_id, reference_asset_id, identity_hash, created_at, updated_at) VALUES (gen_random_uuid(), '$PROJECT_ID', 'char-1', 'asset-0', 'hash-1', now(), now()) RETURNING id" | head -n 1)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, details, created_at) VALUES (gen_random_uuid(), '$SHOT_ID', 'char-1', '$ANCHOR_ID', 'asset-1', 0.5, 'FAIL', '{}', now())"

SCORE_RES=$(curl -s -X POST "$API_URL/api/quality/score" -H "Content-Type: application/json" -d "{\"shotId\": \"$SHOT_ID\", \"traceId\": \"$TRACE_ID\", \"attempt\": 1}")
VERDICT=$(echo $SCORE_RES | jq -r '.verdict')

if [ "$VERDICT" != "FAIL" ]; then log_fail "A1 Failed: Expected FAIL, got $VERDICT"; exit 1; fi
log_success "Assertion A1 (FAIL) PASSED"

# 3. 场景 B: 幂等性硬拦截 (IDEMPOTENCY_HIT via ShotReworkDedupe)
log_info "Scenario B: Idempotency hit audit..."
SCORE_RES_B=$(curl -s -X POST "$API_URL/api/quality/score" -H "Content-Type: application/json" -d "{\"shotId\": \"$SHOT_ID\", \"traceId\": \"$TRACE_ID\", \"attempt\": 1}")
STOP_REASON_B=$(echo $SCORE_RES_B | jq -r '.signals.stopReason')

if [ "$STOP_REASON_B" != "IDEMPOTENCY_HIT" ]; then
    log_fail "Assertion B (Idempotency) Failed: Expected STOP_REASON=IDEMPOTENCY_HIT, got $STOP_REASON_B"
    exit 1
fi
log_success "Assertion B (STOP_REASON=IDEMPOTENCY_HIT) PASSED"

# 4. 场景 C: 返工上限审计 (MAX_ATTEMPT_REACHED)
log_info "Scenario C: Max attempt reaching audit..."
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, details, created_at) VALUES (gen_random_uuid(), '$SHOT_ID', 'char-1', '$ANCHOR_ID', 'asset-1', 0.4, 'FAIL', '{}', now())"

SCORE_RES_C=$(curl -s -X POST "$API_URL/api/quality/score" -H "Content-Type: application/json" -d "{\"shotId\": \"$SHOT_ID\", \"traceId\": \"$TRACE_ID\", \"attempt\": 2}")
STOP_REASON_C=$(echo $SCORE_RES_C | jq -r '.signals.stopReason')

if [ "$STOP_REASON_C" != "MAX_ATTEMPT_REACHED" ]; then
    log_fail "Assertion C (Max Attempt) Failed: Expected STOP_REASON=MAX_ATTEMPT_REACHED, got $STOP_REASON_C"
    exit 1
fi
log_success "Assertion C (STOP_REASON=MAX_ATTEMPT_REACHED) PASSED"

# 5. 场景 D: 预算闸负向测试 (BUDGET_GUARD_BLOCKED - REAL)
log_info "Scenario D: Budget Guard REAL negative test..."
# 1. 设置 2 号分镜用于预算测试
SHOT_ID_BUDGET=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", index, type) VALUES (gen_random_uuid(), '$SCENE_ID', 'gate-org', 2, 'SHOT_RENDER') RETURNING id" | head -n 1)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, details, created_at) VALUES (gen_random_uuid(), '$SHOT_ID_BUDGET', 'char-1', '$ANCHOR_ID', 'asset-1', 0.5, 'FAIL', '{}', now())"

# 2. 物理设置 Credits 为 0
psql "$DATABASE_URL" -c "UPDATE organizations SET credits = 0 WHERE id = 'gate-org'"

SCORE_RES_D=$(curl -s -X POST "$API_URL/api/quality/score" -H "Content-Type: application/json" -d "{\"shotId\": \"$SHOT_ID_BUDGET\", \"traceId\": \"$TRACE_ID\", \"attempt\": 1}")
STOP_REASON_D=$(echo $SCORE_RES_D | jq -r '.signals.stopReason')

if [ "$STOP_REASON_D" != "BUDGET_GUARD_BLOCKED" ]; then
    log_fail "Assertion D (Budget Guard) Failed: Expected STOP_REASON=BUDGET_GUARD_BLOCKED, got $STOP_REASON_D"
    exit 1
fi
log_success "Assertion D (STOP_REASON=BUDGET_GUARD_BLOCKED) PASSED"

# 6. 证据持久化 (Data Dump)
log_info "Step 6: Archiving sealing evidence..."
psql "$DATABASE_URL" -c "COPY (SELECT * FROM quality_scores WHERE signals->>'stopReason' IS NOT NULL) TO STDOUT WITH CSV HEADER" > "$EVIDENCE_ROOT/quality_scores_dump.csv"
psql "$DATABASE_URL" -c "COPY (SELECT * FROM shot_jobs WHERE \"projectId\" = '$PROJECT_ID') TO STDOUT WITH CSV HEADER" > "$EVIDENCE_ROOT/rework_jobs_dump.csv"
psql "$DATABASE_URL" -c "COPY (SELECT * FROM shot_rework_dedupe WHERE trace_id = '$TRACE_ID') TO STDOUT WITH CSV HEADER" > "$EVIDENCE_ROOT/rework_dedupe_dump.csv"

# 生成哈希索引
cd "$EVIDENCE_ROOT"
find . -type f ! -name "SHA256SUMS.txt" ! -name "EVIDENCE_HASH_INDEX.json" -exec sha256sum {} + > SHA256SUMS.txt

# 生成 EVIDENCE_HASH_INDEX.json
echo "{" > EVIDENCE_HASH_INDEX.json
echo "  \"gate\": \"$GATE_NAME\"," >> EVIDENCE_HASH_INDEX.json
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> EVIDENCE_HASH_INDEX.json
echo "  \"files\": {" >> EVIDENCE_HASH_INDEX.json
while read -r hash file; do
    file_clean=$(echo $file | sed 's|./||')
    echo "    \"$file_clean\": \"$hash\"," >> EVIDENCE_HASH_INDEX.json
done < SHA256SUMS.txt
# 移除最后一个逗号 (macOS compliant)
sed -i '' '$ s/,$//' EVIDENCE_HASH_INDEX.json
echo "  }" >> EVIDENCE_HASH_INDEX.json
echo "}" >> EVIDENCE_HASH_INDEX.json

log_success "DOUBLE PASS: P13-3 Quality Auto-Rework 0-RISK SEALED!"
log_info "Evidence saved to: $EVIDENCE_ROOT"
