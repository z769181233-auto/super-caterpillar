#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p6_0_config_secrets.sh <evidence_dir>}"
mkdir -p "$EVI"

need git
need node

log "[P6-0] scanning tracked env files..."
# 1) forbid committing real .env (allow: .env.example/.env.sample/.env.template/.benchmark_env)
TRACKED_ENV="$(git ls-files | grep -E '(^|/)\.env($|[^a-zA-Z0-9])|(^|/)\.env\.' || true)"
printf "%s\n" "$TRACKED_ENV" > "$EVI/p6_0_tracked_env_files.txt"

BAD_ENV="$(printf "%s\n" "$TRACKED_ENV" | grep -Ev '\.env\.(example|sample|template)$|\.benchmark_env$|\.env\.benchmark$|\.env\.local\.example$|^$' || true)"
if [ -n "${BAD_ENV:-}" ]; then
  log "[P6-0] FAIL: committed env-like files detected"
  printf "%s\n" "$BAD_ENV" > "$EVI/p6_0_committed_env_violation.txt"
  STATUS="FAIL"
else
  STATUS="PASS"
fi

log "[P6-0] scanning for likely secrets (file:line only, no content)..."
# 2) patterns (tokens/keys/private keys/JWT-like)
HITS=()
H1="$(grep_hits_fileline '-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----' .)"
H2="$(grep_hits_fileline '\b(sk-[A-Za-z0-9]{20,})\b' .)"
H3="$(grep_hits_fileline '\bAKIA[0-9A-Z]{16}\b' .)"
H4="$(grep_hits_fileline '\bpk\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b' .)" # common jwt-like public token form
H5="$(grep_hits_fileline '\bxox[baprs]-[A-Za-z0-9-]{10,}\b' .)" # slack tokens
printf "%s\n%s\n%s\n%s\n%s\n" "$H1" "$H2" "$H3" "$H4" "$H5" | sed '/^$/d' > "$EVI/p6_0_secret_scan_hits_fileline.txt"

if [ -s "$EVI/p6_0_secret_scan_hits_fileline.txt" ]; then
  log "[P6-0] FAIL: potential secret material detected (see p6_0_secret_scan_hits_fileline.txt)"
  STATUS="FAIL"
fi

# 3) forbid obvious bypass flags in code (exclude tools/p6 and tools/smoke where we validate these flags)
BYPASS_HITS="$(grep_hits_fileline '(DISABLE|BYPASS|SKIP)_(AUTH|HMAC|CREDITS|LEDGER|QUOTA)|CREDITS_DISABLED|LEDGER_DISABLED' apps packages tools | grep -vE 'tools/(p6|smoke)/' || true)"
printf "%s\n" "$BYPASS_HITS" | sed '/^$/d' > "$EVI/p6_0_bypass_flag_hits_fileline.txt"
if [ -s "$EVI/p6_0_bypass_flag_hits_fileline.txt" ]; then
  log "[P6-0] FAIL: bypass-like flags detected in code paths"
  STATUS="FAIL"
fi

REPORT="$EVI/p6_0_config_secrets_audit.json"
json_write "$REPORT" "$(node - <<'NODE'
const out = {
  gate: "P6-0",
  name: "config/secrets sanity",
  status: process.env.STATUS || "UNKNOWN",
  artifacts: {
    tracked_env_files: "p6_0_tracked_env_files.txt",
    committed_env_violation: "p6_0_committed_env_violation.txt",
    secret_scan_hits_fileline: "p6_0_secret_scan_hits_fileline.txt",
    bypass_flag_hits_fileline: "p6_0_bypass_flag_hits_fileline.txt",
  },
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
NODE
)"

if [ "$STATUS" != "PASS" ]; then
  exit 1
fi
