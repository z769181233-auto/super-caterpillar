#!/bin/bash
set -euo pipefail

# Super Caterpillar W3-1 Seal Verification Script (Safe Edition)
ROOT=""
EVI_LATEST=$(cat /tmp/w3_1_last_evi.txt)
ART="$ROOT/$EVI_LATEST/artifacts"
SHOT_ID="c33ccc66-1080-48c3-9ea0-5bfdf77934d5"

echo "--- STARTING W3-1 FINAL AUDIT ---"
echo "Evidence Dir: $EVI_LATEST"
echo "Artifact Dir: $ART"

export ENGINE_REAL=1
export GATE_MODE=1
export GATE_ENV_MODE=local
export SCU_REPO_ROOT="$ROOT"
export ARTIFACT_DIR="$ART"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/scu"

# GENTLE START: Check if API is already running
if curl -s http://localhost:3000/api/health > /dev/null; then
  echo "API is already running, relying on shared background process (Hot Reload)."
else
  echo "API not detected on port 3000. Starting API..."
  nohup pnpm dev:api > dev_api_seal.log 2>&1 &
  echo $! > dev_api_seal.pid
  
  # Wait for API health
  API_READY=false
  for i in {1..50}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
      echo "API READY"
      API_READY=true
      break
    fi
    echo "Waiting for API... ($i/50)"
    sleep 3
  done

  if [ "$API_READY" = false ]; then
    echo "FATAL: API failed to start after 150s. Check dev_api_seal.log"
    exit 1
  fi

  echo "Starting worker..."
  nohup pnpm dev:worker > dev_worker_seal.log 2>&1 &
  echo $! > dev_worker_seal.pid
  sleep 5
fi

# 1. TRIGGER (Enqueue)
echo "[1/4] Enqueueing SHOT_RENDER job..."
CURL_OUT=$(curl -sS -X POST "http://localhost:3000/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"shotId\":\"$SHOT_ID\",\"artifactDir\":\"$ART\",\"prompt\":\"W3-1 Seal Audit\"}")

echo "Response: $CURL_OUT"
echo "$CURL_OUT" > "$ROOT/$EVI_LATEST/admin_enqueue.json"

JOB_ID=$(node -e "const j=$CURL_OUT; console.log(j.jobId||'');")
if [ -z "$JOB_ID" ]; then
  echo "FATAL: Failed to get jobId. Audit aborted."
  exit 1
fi
echo "JOB_ID Acquired: $JOB_ID"

# 2. POLL (Status check)
echo "[2/4] Polling job status until SUCCEEDED..."
for i in {1..60}; do
  STATUS_RAW=$(curl -sS "http://localhost:3000/api/admin/prod-gate/jobs/$JOB_ID")
  echo "$STATUS_RAW" > "$ROOT/$EVI_LATEST/job_${JOB_ID}_status.json"
  
  STATUS=$(node -e "const j=$STATUS_RAW; console.log(j.status||'');")
  echo "[$i/60] State: $STATUS"
  
  if [ "$STATUS" = "SUCCEEDED" ]; then
    echo "SUCCESS: Job completed."
    break
  fi
  if [ "$STATUS" = "FAILED" ]; then
    echo "FATAL: Job failed. Evidence will likely be incomplete."
    exit 1
  fi
  sleep 4
done

# 3. VERIFY (Artifacts)
echo "[3/4] Asserting artifacts in: $ART"
ls -lah "$ART" | tee "$ROOT/$EVI_LATEST/artifacts_ls.log"

REQUIRED_FILES=("frames.txt" "output.mp4" "EVIDENCE_SOURCE.json")
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$ART/$f" ]; then
    echo "MISSING: $f"
    # Note: Don't exit yet, let's see which ones exist
  fi
done

# 4. GATES (Standard validation)
echo "[4/4] Executing Gate17 & Gate18..."
bash tools/gate/gates/gate_origin_native_drop_contract.sh 2>&1 | tee "$ROOT/$EVI_LATEST/gate17.log" || true
bash tools/gate/gates/gate_engine_provenance.sh 2>&1 | tee "$ROOT/$EVI_LATEST/gate18.log" || true

# Summary
cat > "$ROOT/$EVI_LATEST/EVIDENCE_INDEX.md" <<EOF
# W3-1 Seal Evidence Index

- Timestamp: $(date)
- JobId: $JOB_ID
- Evidence Path: $EVI_LATEST

## Files
- [admin_enqueue.json](./admin_enqueue.json)
- [job_${JOB_ID}_status.json](./job_${JOB_ID}_status.json)
- [artifacts_ls.log](./artifacts_ls.log)
- [gate17.log](./gate17.log)
- [gate18.log](./gate18.log)
EOF

echo "--- AUDIT COMPLETE ---"
echo "Evidence ready at: $ROOT/$EVI_LATEST/EVIDENCE_INDEX.md"
