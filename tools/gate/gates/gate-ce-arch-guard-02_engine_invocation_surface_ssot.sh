#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

GATE_NAME="CE-ARCH-GUARD-02_ENGINE_INVOCATION_SURFACE_SSOT"
EVID_DIR="docs/_evidence/CE02_SEAL_20260110/engine_invocation_surface_ssot"
REPO_JSON="docs/ssot/engine_invocation_surface_ssot.json"

mkdir -p "$EVID_DIR"

echo "--- [GATE] ${GATE_NAME} START ---"

# Pre-checks
if ! command -v jq >/dev/null 2>&1; then
  echo "[FAIL] jq is required."
  exit 11
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[FAIL] pnpm is required."
  exit 12
fi

if [[ ! -f "$REPO_JSON" ]]; then
  echo "[FAIL] SSOT missing: $REPO_JSON"
  echo "       Run: pnpm -w -s ts-node tools/ssot/gen_engine_invocation_surface_ssot.ts"
  exit 13
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "[SCAN] Generating SSOT to temp: $TMP_DIR"
pnpm -w -s ts-node tools/ssot/gen_engine_invocation_surface_ssot.ts --output-dir "$TMP_DIR" >/dev/null

TMP_JSON="$TMP_DIR/engine_invocation_surface_ssot.json"
if [[ ! -f "$TMP_JSON" ]]; then
  echo "[FAIL] Temp SSOT JSON missing: $TMP_JSON"
  exit 14
fi

# 4.1 Validate JSON syntax
jq . "$REPO_JSON" >/dev/null
jq . "$TMP_JSON" >/dev/null

# 4.2 Forbidden fields check (must never appear in SSOT JSON)
FORBIDDEN_RE=if grep -E "$FORBIDDEN_RE" "$REPO_JSON" >/dev/null; then
  echo "[FAIL] SSOT contains non-deterministic fields (forbidden)."
  exit 21
fi
if grep -E "$FORBIDDEN_RE" "$TMP_JSON" >/dev/null; then
  echo "[FAIL] Generated temp SSOT contains non-deterministic fields (forbidden)."
  exit 22
fi

# 4.3 Technical debt allowlist hard cap (set equality; order irrelevant)
REPO_ALLOWLIST="$(jq -r TMP_ALLOWLIST="$(jq -r if [[ "$REPO_ALLOWLIST" != "$TMP_ALLOWLIST" ]]; then
  echo "[FAIL] Technical debt allowlist changed (expansion prohibited)."
  echo "Repo: $REPO_ALLOWLIST"
  echo "Tmp : $TMP_ALLOWLIST"
  exit 31
fi
echo "[ALLOWLIST] Technical Debt allowlist unchanged ✓"

# 4.4 Diff check (SSOT must be synchronized)
if ! diff -u "$REPO_JSON" "$TMP_JSON" >/dev/null; then
  echo "[FAIL] SSOT out of sync. Please run generator and commit the updated SSOT:"
  echo "       pnpm -w -s ts-node tools/ssot/gen_engine_invocation_surface_ssot.ts"
  echo
  echo "[DIFF] (first 200 lines)"
  diff -u "$REPO_JSON" "$TMP_JSON" | sed -n   exit 41
fi

echo "[DIFF] SSOT synchronized ✓"

# Evidence log (volatile info allowed here)
TS="$(date +%Y%m%d_%H%M%S)"
EVID_FILE="$EVID_DIR/gate_ce_arch_guard_02_${TS}.txt"
{
  echo "--- [GATE] ${GATE_NAME} PASS ---"
  echo "timestamp: $(date   echo "repo_json: ${REPO_JSON}"
  echo "scan_ranges: apps/api/src, apps/workers/src"
  echo "notes: volatile info is logged here only; SSOT JSON is deterministic."
} > "$EVID_FILE"

echo "[EVIDENCE] $EVID_FILE"
echo "--- [GATE] ${GATE_NAME} END ---"
