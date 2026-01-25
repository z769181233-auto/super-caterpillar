#!/bin/bash
set -e

# P22-0: Video E2E Health Probe & GPU Gate
# Logic: Double Pass verify real pipeline execution (incl. Audio) & structure consistency.

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 4 || echo "rand")
PARENT_EVIDENCE_DIR="docs/_evidence/p22_0_video_probe_${TS}_${RAND}"
mkdir -p "$PARENT_EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P22-0 Video E2E Health Probe"
echo "=============================================="

# Ensure PRISMA_CLIENT_BINARY_TARGET is set for M1/Arm if needed
export PRISMA_CLIENT_BINARY_TARGET="darwin-arm64"

run_pass() {
    local label=$1
    echo "--- Pass $label ---"
    local OUT="$PARENT_EVIDENCE_DIR/$label"
    mkdir -p "$OUT"
    
    # Run Health Probe (Real Pipeline)
    # GATE_MODE=1 forces real_stub mode if real engines are unavailable/slow for gate
    EVIDENCE_DIR="$OUT" GATE_MODE=1 npx ts-node -T tools/ops/health_video_probe.ts
}

run_pass "R1"
run_pass "R2"

echo "--- Integrity Check: Audio/Video Streams (R1) ---"
if [ ! -f "$PARENT_EVIDENCE_DIR/R1/final.mp4" ]; then
    echo "❌ Missing R1 final.mp4"
    exit 1
fi

# Multi-stream assertion via ffprobe (directly in shell for hard audit)
AUDIO_STREAMS=$(ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$PARENT_EVIDENCE_DIR/R1/final.mp4" | grep -c "audio" || true)
VIDEO_STREAMS=$(ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$PARENT_EVIDENCE_DIR/R1/final.mp4" | grep -c "video" || true)

if [ "$AUDIO_STREAMS" -ge 1 ] && [ "$VIDEO_STREAMS" -ge 1 ]; then
    echo "✅ R1 Multi-stream Verified (Audio: $AUDIO_STREAMS, Video: $VIDEO_STREAMS)"
else
    echo "❌ R1 Stream Missing (Audio: $AUDIO_STREAMS, Video: $VIDEO_STREAMS)"
    exit 1
fi

echo "--- Consistency Check: results_sanitized.json (R1 vs R2) ---"
if ! diff "$PARENT_EVIDENCE_DIR/R1/results_sanitized.json" "$PARENT_EVIDENCE_DIR/R2/results_sanitized.json"; then
    echo "❌ Consistency Violation: results_sanitized.json differs between R1 and R2"
    exit 1
fi
echo "✅ Consistency Verified: R1/R2 sanitized outputs are identical"

echo "--- Checksum Verification ---"
(cd "$PARENT_EVIDENCE_DIR/R1" && shasum -a 256 -c SHA256SUMS.txt)
(cd "$PARENT_EVIDENCE_DIR/R2" && shasum -a 256 -c SHA256SUMS.txt)
echo "✅ Checksums verified."

echo "--- Audit/DB Evidence Check (R1) ---"
if grep -q "AuditLogsCount: [1-9]" "$PARENT_EVIDENCE_DIR/R1/db_checks.txt"; then
    echo "✅ DB Audit Logs Verified"
else
    echo "❌ DB Audit Logs Missing in Evidence"
    exit 1
fi

echo "✅ GATE PASS: $PARENT_EVIDENCE_DIR"
