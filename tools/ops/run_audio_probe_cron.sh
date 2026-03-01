#!/usr/bin/env bash
set -euo pipefail

# P21-0 Audio Probe Cron Wrapper
# Usage: ./tools/ops/run_audio_probe_cron.sh

EVID_ROOT="${EVID_ROOT:-docs/_evidence}"
PROBE_TIMEOUT_SEC="${PROBE_TIMEOUT_SEC:-20}"

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-0' < /dev/urandom | head -c 4 || echo "rand")
EVID_DIR="${EVID_ROOT}/p21_0_audio_probe_${TS}_${RAND}"
mkdir -p "$EVID_DIR"

LOG_FILE="${EVID_DIR}/probe.log"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting Audio Probe..." | tee -a "$LOG_FILE"
echo "Evidence Directory: $EVID_DIR" | tee -a "$LOG_FILE"

# Run the probe
# Use -T for faster execution (skip type check)
if EVIDENCE_DIR="$EVID_DIR" npx ts-node -T tools/ops/health_audio_probe.ts > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2); then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Audio Probe SUCCESS" | tee -a "$LOG_FILE"
    exit 0
else
    EXIT_CODE=$?
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Audio Probe FAILED (Exit Code: $EXIT_CODE)" | tee -a "$LOG_FILE"
    exit "$EXIT_CODE"
fi
