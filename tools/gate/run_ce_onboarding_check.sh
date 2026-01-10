#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

UPDATE_MODE=0
if [[ "${1:-}" == "--update" ]]; then
  UPDATE_MODE=1
elif [[ -n "${1:-}" ]]; then
  echo "[FAIL] Unknown arg: ${1}"
  echo "Usage:"
  echo "  bash tools/gate/run_ce_onboarding_check.sh"
  echo "  bash tools/gate/run_ce_onboarding_check.sh --update"
  exit 2
fi

EVID_DIR="docs/_evidence/CE_ONBOARDING_CHECK"
mkdir -p "$EVID_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
EVID_FILE="${EVID_DIR}/check_${TS}.txt"

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

divider() {
  echo "=================================================="
}

run_step() {
  local name="$1"
  local cmd="$2"
  echo
  divider
  echo "[RUN] ${name}"
  divider
  # shellcheck disable=SC2086
  bash -lc "$cmd"
  echo "[OK] ${name}"
}

{
  divider
  echo "[CE ONBOARDING CHECK] START"
  divider
  echo "Mode: $([[ "$UPDATE_MODE" -eq 1 ]] && echo "UPDATE (--update)" || echo "CHECK (default)")"
  echo "Repo: ${ROOT_DIR}"
  echo "Tmp:  ${TMP_DIR}"
  echo "Time: $(date '+%Y-%m-%dT%H:%M:%S%z')"

  # [1/5] SSOT Generator
  if [[ "$UPDATE_MODE" -eq 1 ]]; then
    run_step "[1/5] SSOT Generator (UPDATE repo SSOT)" \
      "pnpm -w -s ts-node tools/ssot/gen_engine_invocation_surface_ssot.ts"
  else
    # CHECK 模式：输出到临时目录，确保不改仓
    run_step "[1/5] SSOT Generator (CHECK, temp output only)" \
      "pnpm -w -s ts-node tools/ssot/gen_engine_invocation_surface_ssot.ts --output-dir \"$TMP_DIR\""
  fi

  # [2/5] Zero Direct Link Gate
  run_step "[2/5] Zero Direct Link Gate" \
    "bash tools/gate/gates/gate-zero_direct_link_repo.sh"

  # [3/5] SSOT Gate (CE-ARCH-GUARD-02)
  run_step "[3/5] SSOT Gate (CE-ARCH-GUARD-02)" \
    "bash tools/gate/gates/gate-ce-arch-guard-02_engine_invocation_surface_ssot.sh"

  # [4/5] Lint
  run_step "[4/5] Lint" \
    "pnpm -w lint"

  # [5/5] TypeCheck
  run_step "[5/5] TypeCheck" \
    "pnpm -w typecheck"

  echo
  divider
  echo "[CE ONBOARDING CHECK] RESULT"
  divider
  echo "SSOT Generator:      ✓ PASS"
  echo "Zero Direct Link:    ✓ PASS"
  echo "SSOT Gate:           ✓ PASS"
  echo "Lint:                ✓ PASS"
  echo "TypeCheck:           ✓ PASS"
  echo "Evidence:            ${EVID_FILE}"
  divider

  # 默认模式：保证不改仓（--update 允许改）
  if [[ "$UPDATE_MODE" -eq 0 ]]; then
    if ! git diff --quiet; then
      echo
      echo "[FAIL] CHECK mode must not modify repo, but git diff is not empty."
      echo "Hint: SSOT generator must fully support --output-dir for check mode."
      echo "---- git diff (first 200 lines) ----"
      git --no-pager diff | sed -n '1,200p'
      exit 3
    fi
    if ! git diff --cached --quiet; then
      echo
      echo "[FAIL] CHECK mode must not stage changes, but git index is not empty."
      echo "---- git diff --cached (first 200 lines) ----"
      git --no-pager diff --cached | sed -n '1,200p'
      exit 4
    fi
    echo "[CHECK MODE] Repo unchanged ✓"
  fi

} 2>&1 | tee "$EVID_FILE"
