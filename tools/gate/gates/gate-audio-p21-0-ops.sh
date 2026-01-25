#!/usr/bin/env bash
set -euo pipefail

# P21-0 Audio: Production Ops Integration Gate
# Logic: Verify all ops tools (Snapshot, Probe, Diagnostics) are functional.

TS=$(date +%s)
RAND=$(env LC_ALL=C tr -dc 'a-z0-0' < /dev/urandom | head -c 4 || echo "rand")
PARENT_EVIDENCE_DIR="docs/_evidence/p21_0_ops_integration_${TS}_${RAND}"
mkdir -p "$PARENT_EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P21-0 Audio Production Ops Integration"
echo "=============================================="

export EVIDENCE_DIR="$PARENT_EVIDENCE_DIR"

# 1. Dashboard Snapshot Integration Check
echo "--- 1. Dashboard Snapshot Integration ---"
bash tools/ops/dashboard_snapshot.sh > "$PARENT_EVIDENCE_DIR/snapshot_stdout.log" 2>&1
LATEST_SNAP=$(ls -td docs/_evidence/p17_0_ops_dashboard_* 2>/dev/null | head -n 1)
if [ -z "$LATEST_SNAP" ]; then
    echo "❌ Failed to find latest snapshot evidence"
    exit 1
fi
if grep -q "audio_" "$LATEST_SNAP/dashboard_snapshot.json"; then
    echo "✅ Snapshot contains Audio Metrics (JSON)"
else
    echo "❌ Snapshot missing Audio Metrics (JSON)"
    exit 1
fi
if grep -q "## Audio Runtime" "$LATEST_SNAP/dashboard_snapshot.md"; then
    echo "✅ Snapshot contains Audio Runtime section (MD)"
else
    echo "❌ Snapshot missing Audio Runtime section (MD)"
    exit 1
fi

# 2. Probe Scheduler Check
echo "--- 2. Probe Scheduler (Cron Wrapper) ---"
if EVID_ROOT="$PARENT_EVIDENCE_DIR" bash tools/ops/run_audio_probe_cron.sh >> "$PARENT_EVIDENCE_DIR/gate_stdout.log" 2>&1; then
    echo "✅ Probe Cron Wrapper SUCCESS"
else
    echo "❌ Probe Cron Wrapper FAIL"
    exit 1
fi

# 3. Diagnostic Tool Check
echo "--- 3. Incident Diagnostics ---"
if ./tools/ops/diagnose_audio_incident.sh >> "$PARENT_EVIDENCE_DIR/gate_stdout.log" 2>&1; then
    echo "✅ Diagnostic Tool SUCCESS"
else
    echo "❌ Diagnostic Tool FAIL"
    exit 1
fi

LATEST_DIAG=$(ls -td docs/_evidence/p21_0_audio_diagnostics_* 2>/dev/null | head -n 1)
if [ -f "$LATEST_DIAG/env_audio_masked.txt" ] && [ -f "$LATEST_DIAG/ops_metrics_snapshot.json" ]; then
    echo "✅ Diagnostic Artifacts Verified"
else
    echo "❌ Diagnostic Artifacts Missing/Incomplete"
    exit 1
fi

# 4. Final Evidence Generation
echo "Finalizing evidence..."
cp "$LATEST_SNAP/dashboard_snapshot.md" "$PARENT_EVIDENCE_DIR/PLAN1_dashboard_snapshot.md"
cp "$LATEST_SNAP/dashboard_snapshot.json" "$PARENT_EVIDENCE_DIR/PLAN1_dashboard_snapshot.json"
ls -R "$PARENT_EVIDENCE_DIR" >> "$PARENT_EVIDENCE_DIR/gate_stdout.log"

echo "✅ GATE PASS: $PARENT_EVIDENCE_DIR"
