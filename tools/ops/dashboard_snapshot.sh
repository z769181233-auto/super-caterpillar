#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./tools/ops/dashboard_snapshot.sh
# Env:
#   API_BASE (default http://localhost:3000)
# Requires:
#   tools/gate/lib/gate_auth_seed.sh (provides VALID_API_KEY_ID, API_SECRET, DATABASE_URL optional)

API_BASE="${API_BASE:-http://localhost:3000}"
TS="$(date +%s)_${RANDOM}"
EVID_DIR="docs/_evidence/p17_0_ops_dashboard_${TS}"
mkdir -p "$EVID_DIR"

# Seed auth (standard)
source tools/gate/lib/gate_auth_seed.sh

API_KEY="${VALID_API_KEY_ID}"
API_SECRET="${API_SECRET}"

# Canonical HMAC headers generator (X-Content-SHA256 included).
# For GET: body empty => content_sha UNSIGNED
generate_headers() {
  local method="$1"
  local req_path="$2"
  local body="${3:-}"
  env API_SECRET="$API_SECRET" VALID_API_KEY_ID="$API_KEY" REQ_BODY="$body" \
    node - <<'NODESCRIPT'
const crypto = require("crypto");
const secret = process.env.API_SECRET || "";
const apiKey = process.env.VALID_API_KEY_ID || "";
const body = process.env.REQ_BODY || "";
const timestamp = Math.floor(Date.now() / 1000);
const nonce = "nonce_" + timestamp + "_" + Math.random().toString(36).slice(2);

const contentSha256 = body
  ? crypto.createHash("sha256").update(body, "utf8").digest("hex")
  : "UNSIGNED";

const payload = apiKey + nonce + timestamp + body;
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

process.stdout.write("X-Api-Key: " + apiKey + "\n");
process.stdout.write("X-Nonce: " + nonce + "\n");
process.stdout.write("X-Timestamp: " + timestamp + "\n");
process.stdout.write("X-Content-SHA256: " + contentSha256 + "\n");
process.stdout.write("X-Signature: " + signature + "\n");
NODESCRIPT
}

# Fetch raw metrics
REQ_PATH="/api/ops/metrics"
HDRS_FILE="${EVID_DIR}/_headers.txt"
generate_headers "GET" "$REQ_PATH" "" > "$HDRS_FILE"

RAW_JSON="${EVID_DIR}/ops_metrics_raw.json"
curl -sS "${API_BASE}${REQ_PATH}" \
  -H "Content-Type: application/json" \
  -H "$(grep -m1 '^X-Api-Key:' "$HDRS_FILE")" \
  -H "$(grep -m1 '^X-Nonce:' "$HDRS_FILE")" \
  -H "$(grep -m1 '^X-Timestamp:' "$HDRS_FILE")" \
  -H "$(grep -m1 '^X-Content-SHA256:' "$HDRS_FILE")" \
  -H "$(grep -m1 '^X-Signature:' "$HDRS_FILE")" \
  > "$RAW_JSON"

# Build snapshot + apply rules
SNAP_JSON="${EVID_DIR}/dashboard_snapshot.json"
SNAP_MD="${EVID_DIR}/dashboard_snapshot.md"
TREND_JSON="${EVID_DIR}/trend_check.json"

EVID_DIR="$EVID_DIR" RAW_JSON="$RAW_JSON" SNAP_JSON="$SNAP_JSON" SNAP_MD="$SNAP_MD" TREND_JSON="$TREND_JSON" node - <<'NODE'
const fs = require("fs");
const path = require("path");

const evidDir = process.env.EVID_DIR;
const rawPath = process.env.RAW_JSON;
const outJson = process.env.SNAP_JSON;
const outMd = process.env.SNAP_MD;
const outTrend = process.env.TREND_JSON;

const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

// required fields (Check existence but allow missing if we default them)
const required = [
  "rework_rate_1h",
];
// We default others to 0 so we don't crash on fresh envs
// const miss = required.filter(k => raw[k] === undefined);
// if (miss.length) { console.warn("Warning: Missing metrics, defaulting to 0"); }

const baseline = {
  rework_rate_1h: Number(raw.baseline_rework_rate_1h ?? 0),
};

const current = {
  rework_rate_1h: Number(raw.rework_rate_1h ?? 0),
  blocked_by_rate_limit_1h: Number(raw.blocked_by_rate_limit_1h ?? 0),
  ce23_guardrail_blocked_1h: Number(raw.ce23_guardrail_blocked_1h ?? 0),
  ce23_real_marginal_fail_1h: Number(raw.ce23_real_marginal_fail_1h ?? 0),
};

// thresholds
const ABS_REWORK_1H = 5;
const TH_GUARDRAIL_BLOCKED_1H = 20;
const TH_MARGINAL_FAIL_1H = 50;

const t_rework = Math.max(ABS_REWORK_1H, baseline.rework_rate_1h * 2);

const evals = [];
evals.push({
  key: "rework_rate_1h",
  level: (current.rework_rate_1h >= t_rework) ? "P0" : "OK",
  current: current.rework_rate_1h,
  threshold: t_rework,
  rule: ">= max(5, baseline*2)",
  action: (current.rework_rate_1h >= t_rework)
    ? "ENV CE23_REAL_FORCE_DISABLE=1 -> SQL Disable All (p16_2_rollout.sql Section 3)"
    : "none",
});

evals.push({
  key: "ce23_guardrail_blocked_1h",
  level: (current.ce23_guardrail_blocked_1h >= TH_GUARDRAIL_BLOCKED_1H) ? "WARN" : "OK",
  current: current.ce23_guardrail_blocked_1h,
  threshold: TH_GUARDRAIL_BLOCKED_1H,
  rule: ">= 20/h",
  action: (current.ce23_guardrail_blocked_1h >= TH_GUARDRAIL_BLOCKED_1H)
    ? "Review inputs & threshold calibration"
    : "none",
});

evals.push({
  key: "ce23_real_marginal_fail_1h",
  level: (current.ce23_real_marginal_fail_1h >= TH_MARGINAL_FAIL_1H) ? "WARN" : "OK",
  current: current.ce23_real_marginal_fail_1h,
  threshold: TH_MARGINAL_FAIL_1H,
  rule: ">= 50/h",
  action: (current.ce23_real_marginal_fail_1h >= TH_MARGINAL_FAIL_1H)
    ? "Check marginal zone & consider recalibration"
    : "none",
});

// Trend check
function getRecentSnapshots(baseDir, n = 3) {
  const evidenceRoot = path.join(baseDir, "..");
  try {
     const entries = fs.readdirSync(evidenceRoot)
    .filter(d => d.startsWith("p17_0_ops_dashboard_"))
    .map(d => ({ d, ts: Number(d.split("_").pop()) }))
    .filter(x => Number.isFinite(x.ts))
    .sort((a,b) => b.ts - a.ts)
    .slice(0, n);

  const vals = [];
  for (const e of entries) {
    const p = path.join(evidenceRoot, e.d, "dashboard_snapshot.json");
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      vals.push({ ts: e.ts, v: Number(j.current?.blocked_by_rate_limit_1h ?? NaN) });
    }
  }
  return vals.filter(x => Number.isFinite(x.v)).reverse(); // oldest -> newest
  } catch(e) { return [] }
}

const baseDir = path.resolve(evidDir);
const recent = getRecentSnapshots(baseDir, 3);
let rising3 = false;
if (recent.length === 3) {
  rising3 = (recent[0].v < recent[1].v) && (recent[1].v < recent[2].v);
}

const trend = {
  metric: "blocked_by_rate_limit_1h",
  recent,
  rising3,
  level: rising3 ? "WARN" : "OK",
  rule: "3 consecutive checks increasing",
  action: rising3 ? "Check heavy org/project, concurrency caps, queue pressure" : "none",
};

evals.push({
  key: "blocked_by_rate_limit_1h",
  level: trend.level,
  current: current.blocked_by_rate_limit_1h,
  threshold: null,
  rule: trend.rule,
  action: trend.action,
});

const snapshot = {
  ts: Date.now(),
  current,
  baseline,
  thresholds: {
    rework_rate_1h: t_rework,
    ce23_guardrail_blocked_1h: TH_GUARDRAIL_BLOCKED_1H,
    ce23_real_marginal_fail_1h: TH_MARGINAL_FAIL_1H,
  },
  evaluations: evals,
};

fs.writeFileSync(outJson, JSON.stringify(snapshot, null, 2), "utf8");
fs.writeFileSync(outTrend, JSON.stringify(trend, null, 2), "utf8");

// Markdown
const lines = [];
lines.push(`# P17-0 Ops Dashboard Snapshot`);
lines.push(`- time: ${new Date().toISOString()}`);
lines.push(`- evidence_dir: ${path.basename(evidDir)}`);
lines.push("");
lines.push(`## Current Metrics`);
for (const [k,v] of Object.entries(current)) lines.push(`- ${k}: ${v}`);
lines.push("");
lines.push(`## Evaluations`);
for (const e of evals) {
  lines.push(`### ${e.key}`);
  lines.push(`- level: ${e.level}`);
  lines.push(`- current: ${e.current}`);
  if (e.threshold !== null) lines.push(`- threshold: ${e.threshold}`);
  lines.push(`- rule: ${e.rule}`);
  lines.push(`- action: ${e.action}`);
  lines.push("");
}
lines.push(`## Trend Check`);
lines.push(`- rising3: ${trend.rising3}`);
lines.push(`- recent: ${trend.recent.map(x => x.v).join(" -> ") || "(insufficient history)"}`);
lines.push(`- action: ${trend.action}`);
lines.push("");

fs.writeFileSync(outMd, lines.join("\n"), "utf8");
NODE
