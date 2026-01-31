#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p9_0_cve_audit.sh <evidence_dir>}"
mkdir -p "$EVI"

need node
need pnpm
need git

# env snapshot (no secrets)
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE=$(node -v)"
  echo "PNPM=$(pnpm -v)"
  echo "TIME=$(date -Iseconds)"
  if [ -f pnpm-lock.yaml ]; then
    echo "PNPM_LOCK_SHA256=$(cat pnpm-lock.yaml | $(sha_tool) | awk '{print $1}')"
  else
    echo "PNPM_LOCK_SHA256=<missing>"
  fi
} > "$EVI/p9_0_env_snapshot.txt"

RAW="$EVI/p9_0_pnpm_audit_raw.json"
LOG="$EVI/p9_0_pnpm_audit.log"
EXITC="0"

set +e
pnpm -s audit --json > "$RAW" 2> "$LOG"
EXITC="$?"
set -e

# Require raw json present
test -s "$RAW" || die "pnpm audit produced empty json (network/registry issue or tool error). See: $LOG"

# Summarize and decide policy:
# PASS policy: no critical/high vulns (post-filtering allowlist)
ALLOWLIST="tools/p9/audit_allowlist.tsv"
[ -f "$ALLOWLIST" ] || printf "# id_type\tid\tpackage\treason\towner\texpires_at\tmitigation\n" > "$ALLOWLIST"

node - <<'NODE' "$RAW" "$ALLOWLIST" "$EVI/p9_0_cve_summary.json" "$EXITC"
const fs = require("fs");

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tsvPath = process.argv[3];
const tsvContent = fs.readFileSync(tsvPath, "utf8");
const tsvLines = tsvContent.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));

const now = new Date();
const allow = [];

for (const line of tsvLines) {
  const cols = line.split("\t");
  if (cols.length < 6) continue;
  const id = cols[1];
  const expires = cols[5];
  
  if (!expires) continue;
  const d = new Date(expires + "T00:00:00Z");
  if (String(d) === "Invalid Date") throw new Error("Invalid expires_at in allowlist: " + line);
  if (d < now) throw new Error("Expired allowlist entry: " + line);
  
  allow.push(id.trim());
}

const exitc = Number(process.argv[5] || "0");

function normalizeFindings(raw){
  // Support npm-audit-like shapes. Best-effort.
  const findings = [];
  if (raw && raw.advisories) {
    for (const [id, adv] of Object.entries(raw.advisories)) {
      findings.push({ id: String(id), severity: adv.severity || "unknown", module: adv.module_name || adv.module || "unknown" });
    }
  } else if (raw && raw.vulnerabilities) {
    // npm v7 style
    for (const [name, v] of Object.entries(raw.vulnerabilities)) {
      const sev = v.severity || "unknown";
      const vias = Array.isArray(v.via) ? v.via : [];
      if (vias.length === 0) findings.push({ id: name, severity: sev, module: name });
      for (const via of vias) {
        if (typeof via === "string") findings.push({ id: via, severity: sev, module: name });
        else findings.push({ id: String(via.source || via.name || name), severity: via.severity || sev, module: name });
      }
    }
  } else if (raw && raw.metadata && raw.metadata.vulnerabilities) {
    // only summary available
  }
  return findings;
}

const findings = normalizeFindings(raw);
const filtered = findings.filter(f => !allow.includes(f.id));

const count = { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 };
for (const f of filtered) {
  const s = String(f.severity || "unknown").toLowerCase();
  if (count[s] === undefined) count.unknown++;
  else count[s]++;
}

const policy = { fail_on: ["critical", "high"], allowlist_count: allow.length };
const status = (count.critical === 0 && count.high === 0) ? "PASS" : "FAIL";

const out = {
  gate: "P9-0",
  name: "dependency compliance (pnpm audit)",
  pnpm_audit_exit_code: exitc,
  status,
  policy,
  counts: count,
  allowlist: allow,
  timestamp: new Date().toISOString()
};

fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 2) + "\n");
NODE

SUMMARY="$EVI/p9_0_cve_summary.json"
STATUS="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SUMMARY','utf8')).status)")"

cat > "$EVI/p9_0_cve_audit.json" <<JSON
{
  "gate": "P9-0",
  "name": "dependency compliance (pnpm audit)",
  "status": "$STATUS",
  "artifacts": {
    "env": "p9_0_env_snapshot.txt",
    "raw": "p9_0_pnpm_audit_raw.json",
    "log": "p9_0_pnpm_audit.log",
    "summary": "p9_0_cve_summary.json",
    "allowlist": "tools/p9/audit_allowlist.tsv"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

[ "$STATUS" = "PASS" ] || die "P9-0 FAIL: high/critical vulnerabilities present (see $SUMMARY)"
log "[P9-0] PASS"
