#!/usr/bin/env bash

# Gate 18: Engine Provenance Verification
# 严格核验：产物完整性 + Provenance 契约一致性 + 数据库溯源反查
# 
# 预期输入：
# EVIDENCE_DIR: 门禁证据目录
# DATABASE_URL: 数据库连接串
#
# 依赖：jq, psql, openssl (sha256)

set -euo pipefail

# 1. 环境准备
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

EVI_DIR="${EVIDENCE_DIR:-docs/_evidence/gate18_provenance_$(date +%Y%m%d_%H%M%S)}"
ART_DIR="${ART_DIR:-$EVIDENCE_DIR/artifacts}" # 约定产物目录在证据下的 artifacts
mkdir -p "$EVI_DIR"

echo "--- Gate 18: Engine Provenance Start ---"
echo "Artifact Directory: $ART_DIR"

# 2. 检查四件套存在性
MP4="$ART_DIR/shot_render_output.mp4"
MP4_SHA="$ART_DIR/shot_render_output.mp4.sha256"
PROV_JSON="$ART_DIR/shot_render_output.provenance.json"
PROV_SHA="$ART_DIR/shot_render_output.provenance.json.sha256"

FAIL=0

for f in "$MP4" "$MP4_SHA" "$PROV_JSON" "$PROV_SHA"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Missing required artifact: $f"
    FAIL=1
  else
    echo "✅ Found: $(basename "$f")"
  fi
done

if [[ $FAIL -eq 1 ]]; then
  echo "❌ Gate 18 Failed: Artifact suite incomplete."
  exit 1
fi

# 3. 产物完整性校验 (SHA256 Match)
echo "--- Integrity Check ---"
CALC_MP4_SHA=$(openssl dgst -sha256 "$MP4" | awk '{print $NF}')
EXPECT_MP4_SHA=$(cat "$MP4_SHA" | tr -d '[:space:]')

if [[ "$CALC_MP4_SHA" != "$EXPECT_MP4_SHA" ]]; then
  echo "❌ MP4 SHA256 mismatch!"
  echo "   Calc: $CALC_MP4_SHA"
  echo "   File: $EXPECT_MP4_SHA"
  FAIL=1
else
  echo "✅ MP4 SHA256 verified."
fi

CALC_PROV_SHA=$(openssl dgst -sha256 "$PROV_JSON" | awk '{print $NF}')
EXPECT_PROV_SHA=$(cat "$PROV_SHA" | tr -d '[:space:]')

if [[ "$CALC_PROV_SHA" != "$EXPECT_PROV_SHA" ]]; then
  echo "❌ Provenance JSON SHA256 mismatch!"
  FAIL=1
else
  echo "✅ Provenance JSON SHA256 verified."
fi

# 4. Provenance 契约约束校验
echo "--- Contract Check (Provenance JSON) ---"
MODE=$(jq -r '.producer.mode' "$PROV_JSON")
RUN_ID=$(jq -r '.producer.engine_run_id' "$PROV_JSON")
JOB_ID=$(jq -r '.job.job_id' "$PROV_JSON")
PROV_SHA_IN_JSON=$(jq -r '.artifact.sha256' "$PROV_JSON")

if [[ "$MODE" != "REAL_ENGINE" ]]; then
  echo "❌ Producer mode must be REAL_ENGINE (got: $MODE)"
  FAIL=1
fi

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "❌ engine_run_id is missing in provenance"
  FAIL=1
fi

if [[ "$PROV_SHA_IN_JSON" != "$CALC_MP4_SHA" ]]; then
  echo "❌ provenance.artifact.sha256 does not match real file sha"
  FAIL=1
fi

echo "✅ Contract constraints passed."

# 5. 数据库反查 (Traceability Check)
echo "--- DB Traceability Check ---"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "⚠️  DATABASE_URL not set, skipping DB check."
else
  # 获取 DB 口径
  TABLE=$(jq -r '.db.job_table' "$PROV_JSON")
  ID_COL=$(jq -r '.db.job_id_col' "$PROV_JSON")
  SHA_COL=$(jq -r '.db.output_sha_col' "$PROV_JSON")
  RUN_COL=$(jq -r '.db.engine_run_id_col' "$PROV_JSON")

  # 执行查询 (确保 camelCase 列名带双引号)
  QUERY="SELECT \"$SHA_COL\", \"$RUN_COL\", status FROM $TABLE WHERE \"$ID_COL\" = '$JOB_ID';"
  echo "Running Query: $QUERY"
  DB_RESULT=$(psql "$DATABASE_URL" -Atc "$QUERY" || echo "DB_ERROR")

  if [[ "$DB_RESULT" == "DB_ERROR" ]]; then
    echo "❌ DB Query failed."
    FAIL=1
  elif [[ -z "$DB_RESULT" ]]; then
    echo "❌ Job ID $JOB_ID not found in database!"
    FAIL=1
  else
    IFS='|' read -r DB_SHA DB_RUN DB_STATUS <<< "$DB_RESULT"
    echo "   DB Result: SHA=$DB_SHA, RUN=$DB_RUN, STATUS=$DB_STATUS"

    if [[ "$DB_SHA" != "$EXPECT_MP4_SHA" ]]; then
      echo "❌ DB SHA256 mismatch ($DB_SHA vs $EXPECT_MP4_SHA)"
      FAIL=1
    fi
    if [[ "$DB_RUN" != "$RUN_ID" ]]; then
      echo "❌ DB engine_run_id mismatch ($DB_RUN vs $RUN_ID)"
      FAIL=1
    fi
    if [[ "$DB_STATUS" != "SUCCEEDED" && "$DB_STATUS" != "COMPLETED" ]]; then
      echo "❌ DB job status is not success (got: $DB_STATUS)"
      FAIL=1
    fi
  fi
fi

# 6. 报告汇总
if [[ $FAIL -eq 0 ]]; then
  echo "✅ Gate 18: Engine Provenance PASS"
  exit 0
else
  echo "❌ Gate 18: Engine Provenance FAILED"
  exit 1
fi
