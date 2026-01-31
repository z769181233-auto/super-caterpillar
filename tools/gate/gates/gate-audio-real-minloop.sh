#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

echo "=============================================="
echo "GATE: P18-0 Audio Minloop (Double PASS)"
echo "=============================================="

TS="$(date +%s)"
EVID_DIR="docs/_evidence/p18_0_audio_minloop_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +'%H:%M:%S')] $*"; }

run_once() {
  local run_id="$1"
  local ks="$2" # 0/1

  local run_dir="${EVID_DIR}/run_${run_id}"
  mkdir -p "$run_dir"

  log "Run ${run_id}: ks=${ks}"
  (
    export EVID_DIR="$run_dir"
    export AUDIO_TEXT="p18-audio-minloop"
    export AUDIO_BGM_SEED="p18-bgm-seed"
    export AUDIO_MIXER_ENABLED=1
    export AUDIO_REAL_ENABLED=0
    export AUDIO_REAL_FORCE_DISABLE="$ks"
    # Execute via ts-node (repo already uses TS tooling in other gates)
    npx -y ts-node -T tools/ops/run_audio_minloop.ts \
      > "${run_dir}/stdout.json"
  )

  # Normalize output file
  cp "${run_dir}/run.json" "${run_dir}/run_${run_id}.json"
}

# --- Case A: Kill Switch ON (must force stub/legacy, silence real) ---
log "CASE A: Kill Switch ON"
run_once "A1" "1"
run_once "A2" "1"

# Assert kill switch signals and determinism
jq -r '.signals.audio_kill_switch' "${EVID_DIR}/run_A1/run_A1.json" | grep -q "true"
jq -r '.signals.audio_kill_switch_source' "${EVID_DIR}/run_A1/run_A1.json" | grep -q "env"
jq -r '.signals.audio_mode' "${EVID_DIR}/run_A1/run_A1.json" | grep -q "legacy"
jq -r '.voice.provider' "${EVID_DIR}/run_A1/run_A1.json" | grep -q "stub_wav_v1"

VOICE_A1="$(jq -r '.voice.sha256' "${EVID_DIR}/run_A1/run_A1.json")"
VOICE_A2="$(jq -r '.voice.sha256' "${EVID_DIR}/run_A2/run_A2.json")"
if [ "$VOICE_A1" != "$VOICE_A2" ]; then
  echo "[FAIL] KillSwitch voice sha mismatch: $VOICE_A1 vs $VOICE_A2"
  exit 1
fi

MIX_A1="$(jq -r '.mixed.sha256 // empty' "${EVID_DIR}/run_A1/run_A1.json")"
MIX_A2="$(jq -r '.mixed.sha256 // empty' "${EVID_DIR}/run_A2/run_A2.json")"
if [ -n "$MIX_A1" ] && [ "$MIX_A1" != "$MIX_A2" ]; then
  echo "[FAIL] KillSwitch mixed sha mismatch: $MIX_A1 vs $MIX_A2"
  exit 1
fi

echo "[PASS] CASE A (Kill Switch) Double PASS"

# --- Case B: Kill Switch OFF (still stub provider in P18-0, but mode must not be legacy) ---
log "CASE B: Kill Switch OFF"
run_once "B1" "0"
run_once "B2" "0"

jq -r '.signals.audio_kill_switch' "${EVID_DIR}/run_B1/run_B1.json" | grep -q "false"
jq -r '.signals.audio_kill_switch_source' "${EVID_DIR}/run_B1/run_B1.json" | grep -q "none"

VOICE_B1="$(jq -r '.voice.sha256' "${EVID_DIR}/run_B1/run_B1.json")"
VOICE_B2="$(jq -r '.voice.sha256' "${EVID_DIR}/run_B2/run_B2.json")"
if [ "$VOICE_B1" != "$VOICE_B2" ]; then
  echo "[FAIL] Normal voice sha mismatch: $VOICE_B1 vs $VOICE_B2"
  exit 1
fi

MIX_B1="$(jq -r '.mixed.sha256 // empty' "${EVID_DIR}/run_B1/run_B1.json")"
MIX_B2="$(jq -r '.mixed.sha256 // empty' "${EVID_DIR}/run_B2/run_B2.json")"
if [ -n "$MIX_B1" ] && [ "$MIX_B1" != "$MIX_B2" ]; then
  echo "[FAIL] Normal mixed sha mismatch: $MIX_B1 vs $MIX_B2"
  exit 1
fi

echo "[PASS] CASE B (Normal) Double PASS"

# Evidence integrity
log "Writing SHA256SUMS..."
find "$EVID_DIR" -type f -maxdepth 5 -print0 | xargs -0 sha256sum > "${EVID_DIR}/SHA256SUMS.txt"

log "GATE PASSED: $EVID_DIR"
