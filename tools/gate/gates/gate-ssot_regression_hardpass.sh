#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +"%Y%m%d_%H%M%S")"
EVDIR="docs/_evidence/ssot_regression_hardpass_${TS}"
mkdir -p "$EVDIR"

LOG="$EVDIR/gate.log"
touch "$LOG"

echo "=== SSOT REGRESSION HARDPASS ===" | tee -a "$LOG"
echo "TS=$TS" | tee -a "$LOG"
echo "ROOT=$ROOT_DIR" | tee -a "$LOG"
echo "EVDIR=$EVDIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# --- helpers ---
fatal() { echo "[FATAL] $*" | tee -a "$LOG"; exit 1; }
info()  { echo "[INFO]  $*" | tee -a "$LOG"; }
run_gate() {
  local gate="$1"
  local out="$EVDIR/$(basename "$gate").log"
  test -f "$gate" || fatal "missing gate script: $gate"
  chmod +x "$gate" || true
  info "RUN: $gate"
  (bash "$gate" 2>&1 | tee "$out") || fatal "gate failed: $gate"
  info "PASS: $gate"
  echo ""
}

# --- anti-ghost-worker cleanup (safe, no-op if none) ---
info "Process cleanup (anti-ghost-worker)"
# Node/ts-node worker-like processes (best-effort)
pkill -f "apps/workers" >/dev/null 2>&1 || true
pkill -f "worker-agent" >/dev/null 2>&1 || true
pkill -f "ts-node.*apps/workers" >/dev/null 2>&1 || true
pkill -f "apps/api/dist/main.js" >/dev/null 2>&1 || true
sleep 1

# --- env sanity (best-effort) ---
info "Env sanity: load .env if present (best-effort)"
set +u
if test -f ".env"; then
  # shellcheck disable=SC2046
  export $(grep -v fi
set -u

# --- typecheck (fast) ---
info "Typecheck"
(pnpm -w run typecheck 2>&1 | tee "$EVDIR/typecheck.log") || fatal "typecheck failed"
info "Typecheck PASS"
echo "" | tee -a "$LOG"

# --- gates list (STRICT: must exist; do not skip) ---
GATES=(
  "tools/gate/gates/gate-ce01_m1_hard.sh"
  "tools/gate/gates/gate-ce02_m1_hard.sh"
  "tools/gate/gates/gate-ce05_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hmac_workerid_regression.sh"
  "tools/gate/gates/gate-stage3_p1_web_audit.sh"
)

# 门栓 1.2：输出交付基线白名单 Manifest
MANIFEST="$EVDIR/GATE_SUITE_MANIFEST.txt"
echo "=== SSOT DELIVERY GATE MANIFEST ===" > "$MANIFEST"
echo "TS: $TS" >> "$MANIFEST"
echo "HEAD_SHA: $(git rev-parse HEAD)" >> "$MANIFEST"
echo "WHITELISTED_GATES:" >> "$MANIFEST"
for g in "${GATES[@]}"; do
  echo "  - $g" >> "$MANIFEST"
done
info "Manifest generated: $MANIFEST"

PASS_COUNT=0
for g in "${GATES[@]}"; do
  run_gate "$g"
  PASS_COUNT=$((PASS_COUNT+1))
done

# --- final 6-line evidence (global) ---
FINAL="$EVDIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "SSOT_REGRESSION=PASS"
  echo "TYPECHECK=PASS"
  echo "GATES_TOTAL=${#GATES[@]}"
  echo "GATES_PASSED=$PASS_COUNT"
  echo "EVIDENCE_DIR=$EVDIR"
  echo "TS=$TS"
} > "$FINAL"

info "DONE. Evidence: $FINAL"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +"%Y%m%d_%H%M%S")"
EVDIR="docs/_evidence/ssot_regression_hardpass_${TS}"
mkdir -p "$EVDIR"

LOG="$EVDIR/gate.log"
touch "$LOG"

echo "=== SSOT REGRESSION HARDPASS ===" | tee -a "$LOG"
echo "TS=$TS" | tee -a "$LOG"
echo "ROOT=$ROOT_DIR" | tee -a "$LOG"
echo "EVDIR=$EVDIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# --- helpers ---
fatal() { echo "[FATAL] $*" | tee -a "$LOG"; exit 1; }
info()  { echo "[INFO]  $*" | tee -a "$LOG"; }
run_gate() {
  local gate="$1"
  local out="$EVDIR/$(basename "$gate").log"
  test -f "$gate" || fatal "missing gate script: $gate"
  chmod +x "$gate" || true
  info "RUN: $gate"
  (bash "$gate" 2>&1 | tee "$out") || fatal "gate failed: $gate"
  info "PASS: $gate"
  echo ""
}

# --- anti-ghost-worker cleanup (safe, no-op if none) ---
info "Process cleanup (anti-ghost-worker)"
# Node/ts-node worker-like processes (best-effort)
pkill -f "apps/workers" >/dev/null 2>&1 || true
pkill -f "worker-agent" >/dev/null 2>&1 || true
pkill -f "ts-node.*apps/workers" >/dev/null 2>&1 || true
pkill -f "apps/api/dist/main.js" >/dev/null 2>&1 || true
sleep 1

# --- env sanity (best-effort) ---
info "Env sanity: load .env if present (best-effort)"
set +u
if test -f ".env"; then
  # shellcheck disable=SC2046
  export $(grep -v fi
set -u

# --- typecheck (fast) ---
info "Typecheck"
(pnpm -w run typecheck 2>&1 | tee "$EVDIR/typecheck.log") || fatal "typecheck failed"
info "Typecheck PASS"
echo "" | tee -a "$LOG"

# --- gates list (STRICT: must exist; do not skip) ---
GATES=(
  "tools/gate/gates/gate-ce01_m1_hard.sh"
  "tools/gate/gates/gate-ce02_m1_hard.sh"
  "tools/gate/gates/gate-ce05_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hmac_workerid_regression.sh"
  "tools/gate/gates/gate-stage3_p1_web_audit.sh"
)

# 门栓 1.2：输出交付基线白名单 Manifest
MANIFEST="$EVDIR/GATE_SUITE_MANIFEST.txt"
echo "=== SSOT DELIVERY GATE MANIFEST ===" > "$MANIFEST"
echo "TS: $TS" >> "$MANIFEST"
echo "HEAD_SHA: $(git rev-parse HEAD)" >> "$MANIFEST"
echo "WHITELISTED_GATES:" >> "$MANIFEST"
for g in "${GATES[@]}"; do
  echo "  - $g" >> "$MANIFEST"
done
info "Manifest generated: $MANIFEST"

PASS_COUNT=0
for g in "${GATES[@]}"; do
  run_gate "$g"
  PASS_COUNT=$((PASS_COUNT+1))
done

# --- final 6-line evidence (global) ---
FINAL="$EVDIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "SSOT_REGRESSION=PASS"
  echo "TYPECHECK=PASS"
  echo "GATES_TOTAL=${#GATES[@]}"
  echo "GATES_PASSED=$PASS_COUNT"
  echo "EVIDENCE_DIR=$EVDIR"
  echo "TS=$TS"
} > "$FINAL"

info "DONE. Evidence: $FINAL"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +"%Y%m%d_%H%M%S")"
EVDIR="docs/_evidence/ssot_regression_hardpass_${TS}"
mkdir -p "$EVDIR"

LOG="$EVDIR/gate.log"
touch "$LOG"

echo "=== SSOT REGRESSION HARDPASS ===" | tee -a "$LOG"
echo "TS=$TS" | tee -a "$LOG"
echo "ROOT=$ROOT_DIR" | tee -a "$LOG"
echo "EVDIR=$EVDIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# --- helpers ---
fatal() { echo "[FATAL] $*" | tee -a "$LOG"; exit 1; }
info()  { echo "[INFO]  $*" | tee -a "$LOG"; }
run_gate() {
  local gate="$1"
  local out="$EVDIR/$(basename "$gate").log"
  test -f "$gate" || fatal "missing gate script: $gate"
  chmod +x "$gate" || true
  info "RUN: $gate"
  (bash "$gate" 2>&1 | tee "$out") || fatal "gate failed: $gate"
  info "PASS: $gate"
  echo ""
}

# --- anti-ghost-worker cleanup (safe, no-op if none) ---
info "Process cleanup (anti-ghost-worker)"
# Node/ts-node worker-like processes (best-effort)
pkill -f "apps/workers" >/dev/null 2>&1 || true
pkill -f "worker-agent" >/dev/null 2>&1 || true
pkill -f "ts-node.*apps/workers" >/dev/null 2>&1 || true
pkill -f "apps/api/dist/main.js" >/dev/null 2>&1 || true
sleep 1

# --- env sanity (best-effort) ---
info "Env sanity: load .env if present (best-effort)"
set +u
if test -f ".env"; then
  # shellcheck disable=SC2046
  export $(grep -v fi
set -u

# --- typecheck (fast) ---
info "Typecheck"
(pnpm -w run typecheck 2>&1 | tee "$EVDIR/typecheck.log") || fatal "typecheck failed"
info "Typecheck PASS"
echo "" | tee -a "$LOG"

# --- gates list (STRICT: must exist; do not skip) ---
GATES=(
  "tools/gate/gates/gate-ce01_m1_hard.sh"
  "tools/gate/gates/gate-ce02_m1_hard.sh"
  "tools/gate/gates/gate-ce05_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hmac_workerid_regression.sh"
  "tools/gate/gates/gate-stage3_p1_web_audit.sh"
)

# 门栓 1.2：输出交付基线白名单 Manifest
MANIFEST="$EVDIR/GATE_SUITE_MANIFEST.txt"
echo "=== SSOT DELIVERY GATE MANIFEST ===" > "$MANIFEST"
echo "TS: $TS" >> "$MANIFEST"
echo "HEAD_SHA: $(git rev-parse HEAD)" >> "$MANIFEST"
echo "WHITELISTED_GATES:" >> "$MANIFEST"
for g in "${GATES[@]}"; do
  echo "  - $g" >> "$MANIFEST"
done
info "Manifest generated: $MANIFEST"

PASS_COUNT=0
for g in "${GATES[@]}"; do
  run_gate "$g"
  PASS_COUNT=$((PASS_COUNT+1))
done

# --- final 6-line evidence (global) ---
FINAL="$EVDIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "SSOT_REGRESSION=PASS"
  echo "TYPECHECK=PASS"
  echo "GATES_TOTAL=${#GATES[@]}"
  echo "GATES_PASSED=$PASS_COUNT"
  echo "EVIDENCE_DIR=$EVDIR"
  echo "TS=$TS"
} > "$FINAL"

info "DONE. Evidence: $FINAL"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +"%Y%m%d_%H%M%S")"
EVDIR="docs/_evidence/ssot_regression_hardpass_${TS}"
mkdir -p "$EVDIR"

LOG="$EVDIR/gate.log"
touch "$LOG"

echo "=== SSOT REGRESSION HARDPASS ===" | tee -a "$LOG"
echo "TS=$TS" | tee -a "$LOG"
echo "ROOT=$ROOT_DIR" | tee -a "$LOG"
echo "EVDIR=$EVDIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# --- helpers ---
fatal() { echo "[FATAL] $*" | tee -a "$LOG"; exit 1; }
info()  { echo "[INFO]  $*" | tee -a "$LOG"; }
run_gate() {
  local gate="$1"
  local out="$EVDIR/$(basename "$gate").log"
  test -f "$gate" || fatal "missing gate script: $gate"
  chmod +x "$gate" || true
  info "RUN: $gate"
  (bash "$gate" 2>&1 | tee "$out") || fatal "gate failed: $gate"
  info "PASS: $gate"
  echo ""
}

# --- anti-ghost-worker cleanup (safe, no-op if none) ---
info "Process cleanup (anti-ghost-worker)"
# Node/ts-node worker-like processes (best-effort)
pkill -f "apps/workers" >/dev/null 2>&1 || true
pkill -f "worker-agent" >/dev/null 2>&1 || true
pkill -f "ts-node.*apps/workers" >/dev/null 2>&1 || true
pkill -f "apps/api/dist/main.js" >/dev/null 2>&1 || true
sleep 1

# --- env sanity (best-effort) ---
info "Env sanity: load .env if present (best-effort)"
set +u
if test -f ".env"; then
  # shellcheck disable=SC2046
  export $(grep -v fi
set -u

# --- typecheck (fast) ---
info "Typecheck"
(pnpm -w run typecheck 2>&1 | tee "$EVDIR/typecheck.log") || fatal "typecheck failed"
info "Typecheck PASS"
echo "" | tee -a "$LOG"

# --- gates list (STRICT: must exist; do not skip) ---
GATES=(
  "tools/gate/gates/gate-ce01_m1_hard.sh"
  "tools/gate/gates/gate-ce02_m1_hard.sh"
  "tools/gate/gates/gate-ce05_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hard.sh"
  "tools/gate/gates/gate-ce07_m1_hmac_workerid_regression.sh"
  "tools/gate/gates/gate-stage3_p1_web_audit.sh"
)

# 门栓 1.2：输出交付基线白名单 Manifest
MANIFEST="$EVDIR/GATE_SUITE_MANIFEST.txt"
echo "=== SSOT DELIVERY GATE MANIFEST ===" > "$MANIFEST"
echo "TS: $TS" >> "$MANIFEST"
echo "HEAD_SHA: $(git rev-parse HEAD)" >> "$MANIFEST"
echo "WHITELISTED_GATES:" >> "$MANIFEST"
for g in "${GATES[@]}"; do
  echo "  - $g" >> "$MANIFEST"
done
info "Manifest generated: $MANIFEST"

PASS_COUNT=0
for g in "${GATES[@]}"; do
  run_gate "$g"
  PASS_COUNT=$((PASS_COUNT+1))
done

# --- final 6-line evidence (global) ---
FINAL="$EVDIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "SSOT_REGRESSION=PASS"
  echo "TYPECHECK=PASS"
  echo "GATES_TOTAL=${#GATES[@]}"
  echo "GATES_PASSED=$PASS_COUNT"
  echo "EVIDENCE_DIR=$EVDIR"
  echo "TS=$TS"
} > "$FINAL"

info "DONE. Evidence: $FINAL"
