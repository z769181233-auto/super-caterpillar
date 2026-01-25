#!/usr/bin/env bash
# tools/gate/gates/gate-api-alias-contract.sh
# P23-0: API Bible Alignment (Alias Routes) Contract Gate
# 验证 /story/parse 和 /text/enrich 别名路由与内部路由的输出一致性。

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
TS="$(date +%s)_$RANDOM"
EVID_DIR="docs/_evidence/p23_0_api_alias_${TS}"
mkdir -p "$EVID_DIR"/{R1,R2}

# 1. Auth Setup
source tools/gate/lib/gate_auth_seed.sh
API_KEY="${VALID_API_KEY_ID}"
API_SECRET="${API_SECRET}"

log_info() {
  echo "[INFO] $1"
}

# 签名生成工具
gen_hdrs () {
  local body="$1"
  env API_SECRET="$API_SECRET" VALID_API_KEY_ID="$API_KEY" REQ_BODY="$body" \
    node - <<'NODE'
const crypto = require("crypto");
const secret = process.env.API_SECRET || "";
const apiKey = process.env.VALID_API_KEY_ID || "";
const body = process.env.REQ_BODY || "";
const timestamp = Math.floor(Date.now()/1000);
const nonce = "nonce_" + timestamp + "_" + Math.random().toString(36).slice(2);
const contentSha256 = body ? crypto.createHash("sha256").update(body,"utf8").digest("hex") : "UNSIGNED";
const payload = apiKey + nonce + timestamp + body;
const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
console.log("X-Api-Key: " + apiKey);
console.log("X-Nonce: " + nonce);
console.log("X-Timestamp: " + timestamp);
console.log("X-Content-SHA256: " + contentSha256);
console.log("X-Signature: " + sig);
NODE
}

# POST JSON 工具
post_json () {
  local path="$1"
  local json="$2"
  local out="$3"
  local hdr="$4"

  gen_hdrs "$json" > "$hdr"
  curl -sS "${API_BASE}${path}" \
    -H "Content-Type: application/json" \
    -H "$(grep -m1 '^X-Api-Key:' "$hdr")" \
    -H "$(grep -m1 '^X-Nonce:' "$hdr")" \
    -H "$(grep -m1 '^X-Timestamp:' "$hdr")" \
    -H "$(grep -m1 '^X-Content-SHA256:' "$hdr")" \
    -H "$(grep -m1 '^X-Signature:' "$hdr")" \
    -d "$json" > "$out"
}

# 数据脱敏工具（移除随机字段以便 diff）
sanitize () {
  node - "$1" <<'NODE'
const fs = require("fs");
const p = process.argv[2];
const content = fs.readFileSync(p,"utf8");
try {
    const j = JSON.parse(content);
    function strip(obj){
      if (!obj || typeof obj !== "object") return obj;
      const out = Array.isArray(obj) ? [] : {};
      for (const k of Object.keys(obj)) {
        // 排除掉所有包含 traceId, jobId, taskId, createdAt, updatedAt 的字段
        if (["traceId","timestamp","createdAt","updatedAt","nonce","latency","audio_vendor_latency_ms","jobId","taskId", "id"].includes(k)) continue;
        if (typeof obj[k] === 'string' && (obj[k].startsWith('req_') || obj[k].startsWith('ce_pipeline_') || obj[k].startsWith('job_') || obj[k].startsWith('task_'))) continue;
        out[k] = strip(obj[k]);
      }
      return out;
    }
    process.stdout.write(JSON.stringify(strip(j), null, 2));
} catch(e) {
    process.stderr.write("Failed to parse JSON: " + content + "\n");
    process.exit(1);
}
NODE
}

log_info "Starting P23-0 Gate: API Alias Contract..."

# 开启内部别名支持（仅门禁期间）
export BIBLE_INTERNAL_ALIAS_ENABLED=1

STORY_PAYLOAD="{\"text\":\"Bible Alias Gate Story Parse test text\",\"projectId\":\"$PROJ_ID\",\"title\":\"Gate Story\",\"author\":\"Gate Bot\"}"
TEXT_PAYLOAD="{\"text\":\"Bible Alias Gate Text Enrich test text\",\"projectId\":\"$PROJ_ID\"}"

# ---- R1: internal ----
log_info "R1: Testing Internal Routes..."
post_json "/_internal/story/parse" "$STORY_PAYLOAD" "$EVID_DIR/R1/story.json" "$EVID_DIR/R1/story.hdr"
post_json "/_internal/text/enrich" "$TEXT_PAYLOAD" "$EVID_DIR/R1/enrich.json" "$EVID_DIR/R1/enrich.hdr"

# ---- R2: alias ----
log_info "R2: Testing Alias Routes..."
post_json "/story/parse" "$STORY_PAYLOAD" "$EVID_DIR/R2/story.json" "$EVID_DIR/R2/story.hdr"
post_json "/text/enrich" "$TEXT_PAYLOAD" "$EVID_DIR/R2/enrich.json" "$EVID_DIR/R2/enrich.hdr"

# 脱敏对比
log_info "Sanitizing results..."
sanitize "$EVID_DIR/R1/story.json" > "$EVID_DIR/R1/story.sanitized.json"
sanitize "$EVID_DIR/R1/enrich.json" > "$EVID_DIR/R1/enrich.sanitized.json"
sanitize "$EVID_DIR/R2/story.json" > "$EVID_DIR/R2/story.sanitized.json"
sanitize "$EVID_DIR/R2/enrich.json" > "$EVID_DIR/R2/enrich.sanitized.json"

log_info "Diffing R1 vs R2..."
diff -u "$EVID_DIR/R1/story.sanitized.json" "$EVID_DIR/R2/story.sanitized.json" > "$EVID_DIR/story.diff" || true
diff -u "$EVID_DIR/R1/enrich.sanitized.json" "$EVID_DIR/R2/enrich.sanitized.json" > "$EVID_DIR/enrich.diff" || true

# 结果判定
STORY_DIFF_SIZE=$(wc -c < "$EVID_DIR/story.diff" | tr -d ' ')
ENRICH_DIFF_SIZE=$(wc -c < "$EVID_DIR/enrich.diff" | tr -d ' ')

if [ "$STORY_DIFF_SIZE" -gt 0 ] || [ "$ENRICH_DIFF_SIZE" -gt 0 ]; then
  echo "[FAIL] P23-0 Gate FAILED: sanitized diff not empty"
  [ "$STORY_DIFF_SIZE" -gt 0 ] && echo "--- Story Diff ---" && cat "$EVID_DIR/story.diff"
  [ "$ENRICH_DIFF_SIZE" -gt 0 ] && echo "--- Enrich Diff ---" && cat "$EVID_DIR/enrich.diff"
  exit 1
fi

echo "=============================================="
echo "[PASS] P23-0 gate ok: $EVID_DIR"
echo "Evidence Sealed."
echo "=============================================="
