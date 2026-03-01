#!/usr/bin/env bash
set -euo pipefail

# P21-0 Audio Incident Diagnostic Tool
# Usage: ./tools/ops/diagnose_audio_incident.sh

TS=$(date +%s)
EVID_DIR="docs/_evidence/p21_0_audio_diagnostics_${TS}"
mkdir -p "$EVID_DIR"

echo "Running Audio Incident Diagnostics..."
echo "Diagnostic Directory: $EVID_DIR"

# 1. Git Head + Tag
git rev-parse HEAD > "$EVID_DIR/git_head.txt"
git tag --points-at HEAD >> "$EVID_DIR/git_head.txt"

# 2. Env Audio (Masked)
env | grep "AUDIO" | sed 's/=[^ ]*/=********/' > "$EVID_DIR/env_audio_masked.txt" || true

# 3. Ops Metrics Snapshot (Direct call)
# Use existing dashboard_snapshot.sh logic or just curl directly if HMAC not needed for local diagnostic?
# Standardizing on /api/ops/metrics via curl (assumes API is reachable)
# We use the HMAC logic from dashboard_snapshot.sh if possible.
# For simplicity in diagnostic, we just try to read the last snapshot if available, 
# or run the snapshot tool to get a fresh one.
bash tools/ops/dashboard_snapshot.sh > /dev/null 2>&1 || true
LATEST_SNAP=$(ls -td docs/_evidence/p17_0_ops_dashboard_* 2>/dev/null | head -n 1 || true)
if [ -n "$LATEST_SNAP" ]; then
    cp "$LATEST_SNAP/ops_metrics_raw.json" "$EVID_DIR/ops_metrics_snapshot.json"
    cp "$LATEST_SNAP/dashboard_snapshot.md" "$EVID_DIR/dashboard_snapshot.md"
fi

# 4. Disk Space
df -h . > "$EVID_DIR/disk_space.txt"
echo "--- tmp ---" >> "$EVID_DIR/disk_space.txt"
ls -lh tmp 2>/dev/null >> "$EVID_DIR/disk_space.txt" || true

# 5. Recent Probe Paths
ls -td docs/_evidence/p21_0_audio_probe_* 2>/dev/null | head -n 5 > "$EVID_DIR/recent_probe_paths.txt"

# 6. Recent Logs (Mock vendor access if in dev)
if [ -f "mock_vendor_access.log" ]; then
    tail -n 50 "mock_vendor_access.log" > "$EVID_DIR/mock_vendor_access_tail.log"
fi

echo "Diagnostics Complete: $EVID_DIR"
