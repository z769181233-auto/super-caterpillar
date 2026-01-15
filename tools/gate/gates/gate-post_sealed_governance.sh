#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-post_sealed_governance.sh
# 聚合门禁单入口 (Single Entry Point)

# 环境加载
COMMON_LOADER="$(dirname "$0")/../common/load_env.sh"
[[ -f "$COMMON_LOADER" ]] && source "$COMMON_LOADER"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/post_sealed_governance_${TS}"
mkdir -p "$EVID_DIR"
export CURRENT_EVID_DIR="$EVID_DIR"

log() { echo "[POST_SEALED][INFO] $*"; }
err() { echo "[POST_SEALED][ERR] $*" >&2; }

# --- 0. 自审计 (Self-Audit) ---
if grep -q $'\x60' "$0"; then
  err "Self-audit failed: Backticks detected in $0"
  exit 1
fi
log "Self-audit OK"

# --- 1. 诚信与完整性审计 (Integrity First) ---
log "Running Integrity Audit..."
bash tools/gate/gates/gate-audit_governance_integrity.sh || exit 1

# --- 2. 运行各红线门禁 ---
GATES=(
  "tools/gate/gates/gate-audit_repo_structure_redline.sh"
  "tools/gate/gates/gate-audit_shell_safety_redline.sh"
  "tools/gate/gates/gate-audit_path_hygiene_redline.sh"
  "tools/gate/gates/gate-audit_psql_dq_redline.sh"
)

for gate in "${GATES[@]}"; do
  log "Executing $gate..."
  bash "$gate" || exit 1
done

# --- 3. 可选：负向测试集成 ---
export NEGATIVE_TEST_STATUS="SKIPPED"
if [[ "${GOV_NEGATIVE_TESTS:-0}" == "1" ]]; then
  log "Executing Negative Tests..."
  # 记录负向测试脚本的 hash
  export NEGATIVE_TEST_SCRIPT_HASH=$(shasum -a 256 tools/gate/gates/negative_tests.sh | awk '{print $1}')
  if bash tools/gate/gates/negative_tests.sh > "$EVID_DIR/negative_tests.log" 2>&1; then
    NEGATIVE_TEST_STATUS="PASS"
  else
    NEGATIVE_TEST_STATUS="FAIL"
    err "Negative tests failed to block expected violations."
    exit 1
  fi
fi

# --- 4. 生成审计证据索引 (EVIDENCE_INDEX.json) ---
log "Generating Evidence Index..."
node <<EOF
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const runDir = process.env.CURRENT_EVID_DIR;
const files = fs.readdirSync(runDir);
const items = [];

for (const f of files) {
  if (f === "EVIDENCE_INDEX.json") continue;
  const content = fs.readFileSync(runDir + "/" + f);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  items.push({ file: f, sha256: hash });
}

// 收集环境信息
let gitCommit = "unknown";
let gitBranch = "unknown";
try {
  gitCommit = execSync("git rev-parse HEAD").toString().trim();
  gitBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
} catch (e) {}

const metadata = {
  timestamp: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  git_commit: gitCommit,
  git_branch: gitBranch,
  runner: execSync("uname -a").toString().trim() + " | Node: " + process.version,
  config_sha256: crypto.createHash("sha256").update(fs.readFileSync("docs/_specs/governance/gov_post_sealed.config.json")).digest("hex"),
  negative_tests: {
    status: process.env.NEGATIVE_TEST_STATUS,
    script_sha256: process.env.NEGATIVE_TEST_SCRIPT_HASH || "N/A"
  },
  items: items
};

fs.writeFileSync(runDir + "/EVIDENCE_INDEX.json", JSON.stringify(metadata, null, 2));
EOF

log "[POST_SEALED][PASS] All post-sealed governance audits passed."
log "[POST_SEALED][PASS] Evidence: $EVID_DIR"
