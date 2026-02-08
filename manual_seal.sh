#!/bin/bash
set -euo pipefail

# Manual W3-1 Seal - Simplified
ROOT="/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar"
EVI_LATEST="docs/_evidence/w3_1_seal_fix_20260207_232857"
ART="$ROOT/$EVI_LATEST/artifacts"
SHOT_ID="c33ccc66-1080-48c3-9ea0-5bfdf77934d5"

echo "=== W3-1 Manual Seal ==="
echo "Artifact Dir: $ART"

# 1. TRIGGER
echo "[1/3] Triggering SHOT_RENDER..."
RESPONSE=$(curl -sS -X POST "http://localhost:3000/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"shotId\":\"$SHOT_ID\",\"artifactDir\":\"$ART\",\"prompt\":\"W3-1 Manual Seal\"}")

echo "$RESPONSE" | tee "$ROOT/$EVI_LATEST/manual_trigger.json"
JOB_ID=$(echo "$RESPONSE" | node -e "const j=JSON.parse(require('fs').readFileSync(0)); console.log(j.jobId||'');")

if [ -z "$JOB_ID" ]; then
  echo "FATAL: No jobId returned"
  echo "$RESPONSE"
  exit 1
fi

echo "Job ID: $JOB_ID"

# 2. POLL
echo "[2/3] Polling job status..."
for i in {1..30}; do
  STATUS_RAW=$(curl -sS "http://localhost:3000/api/admin/prod-gate/jobs/$JOB_ID")
  STATUS=$(echo "$STATUS_RAW" | node -e "const j=JSON.parse(require('fs').readFileSync(0)); console.log(j.status||'');")
  echo "  [$i/30] $STATUS"
  
  if [ "$STATUS" = "SUCCEEDED" ]; then
    echo "✅ Job SUCCEEDED"
    break
  fi
  if [ "$STATUS" = "FAILED" ]; then
    echo "❌ Job FAILED"
    echo "$STATUS_RAW"
    exit 1
  fi
  sleep 3
done

# 3. VERIFY
echo "[3/3] Verifying artifacts..."
ls -lah "$ART"

echo "=== Seal Complete ==="
echo "Evidence: $ROOT/$EVI_LATEST"
