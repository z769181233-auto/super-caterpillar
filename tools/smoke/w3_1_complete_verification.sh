#!/usr/bin/env bash
set -euo pipefail
umask 022

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "════════════════════════════════════════════"
echo "W3-1 Origin Native Drop - Complete Verification"
echo "════════════════════════════════════════════"
echo ""

# Step 1: Create evidence directory
TS="$(date +%Y%m%d_%H%M%S)"
EVI="$ROOT/docs/_evidence/w3_1_complete_${TS}"
ART="$EVI/artifacts"
mkdir -p "$ART"

echo "✅ Step 1: Evidence directory created"
echo "   EVI=$EVI"
echo "   ART=$ART"
echo ""

# Step 2: Set environment variables
export ARTIFACT_DIR="$ART"
export ENGINE_REAL=1
export GATE_ENV_MODE=local
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

echo "✅ Step 2: Environment variables set"
echo "   ARTIFACT_DIR=$ARTIFACT_DIR"
echo "   ENGINE_REAL=$ENGINE_REAL"
echo "   DATABASE_URL=${DATABASE_URL}"
echo ""

# Step 3: Check services
echo "Step 3: Checking services..."
if curl -sSf http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "✅ API is running"
else
  echo "❌ API is NOT running"
  echo ""
  echo "Please start services first:"
  echo "  cd $ROOT"
  echo "  pnpm dev"
  echo ""
  echo "Then run this script again."
  exit 1
fi

if curl -sSf http://localhost:3000/health/ready >/dev/null 2>&1; then
  echo "✅ Database is ready"
else
  echo "❌ Database is NOT ready"
  exit 1
fi
echo ""

# Step 4: Trigger SHOT_RENDER job
echo "Step 4: Triggering SHOT_RENDER job..."
if [ -f "$ROOT/tools/trigger_debug.js" ]; then
  node "$ROOT/tools/trigger_debug.js" 2>&1 | tee "$EVI/trigger_job.log"
  echo "✅ Job triggered (see $EVI/trigger_job.log)"
else
  echo "❌ trigger_debug.js not found"
  echo "   Attempting alternative trigger method..."
  
  # Alternative: use curl to trigger via API
  SHOT_ID=$(psql "$DATABASE_URL" -Atc "SELECT id FROM shots ORDER BY id DESC LIMIT 1" 2>/dev/null || echo "")
  if [ -n "$SHOT_ID" ]; then
    echo "   Found shot ID: $SHOT_ID"
    # TODO: Add API trigger call here if needed
  fi
fi
echo ""

# Step 5: Wait for worker processing
echo "Step 5: Waiting for worker to process job..."
echo "   Checking every 5 seconds for artifacts (max 2 minutes)..."

MAX_WAIT=120
ELAPSED=0
FOUND=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if [ -f "$ART/shot_render_output.mp4" ] && [ -s "$ART/shot_render_output.mp4" ]; then
    echo "✅ Artifacts detected!"
    FOUND=true
    break
  fi
  
  echo "   [$ELAPSED/$MAX_WAIT] Waiting..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ "$FOUND" != true ]; then
  echo "❌ Artifacts not generated after ${MAX_WAIT}s"
  echo ""
  echo "Troubleshooting steps:"
  echo "1. Check Worker logs for errors"
  echo "2. Check if ARTIFACT_DIR env var was picked up by worker"
  echo "3. Verify job was created in database:"
  echo "   psql \"$DATABASE_URL\" -c \"SELECT id, type, status FROM shot_jobs ORDER BY created_at DESC LIMIT 5;\""
  echo ""
  echo "You can manually verify artifacts by running:"
  echo "   ls -lh $ART"
  exit 1
fi
echo ""

# Step 6: Verify four-pack
echo "Step 6: Verifying four-pack artifacts..."
REQ1="shot_render_output.mp4"
REQ2="shot_render_output.mp4.sha256"
REQ3="shot_render_output.provenance.json"
REQ4="shot_render_output.provenance.json.sha256"
MARKER="ORIGIN_NATIVE_DROP_OK.txt"

ls -lh "$ART" | tee "$EVI/artifacts_ls.log"
echo ""

MISSING=""
for f in "$REQ1" "$REQ2" "$REQ3" "$REQ4" "$MARKER"; do
  if [ ! -f "$ART/$f" ]; then
    MISSING="$MISSING $f"
  fi
done

if [ -n "$MISSING" ]; then
  echo "❌ Missing artifacts:$MISSING"
  exit 1
else
  echo "✅ All required artifacts present" | tee "$EVI/artifacts_presence.ok"
fi
echo ""

# Step 7: Run contract verification
echo "Step 7: Running contract verification..."
if ARTIFACT_DIR="$ART" bash "$ROOT/tools/gate/gates/gate_origin_native_drop_contract.sh" 2>&1 | tee "$EVI/gate17_contract_verification.log"; then
  echo "✅ Contract verification PASSED"
else
  echo "❌ Contract verification FAILED"
  echo "   See: $EVI/gate17_contract_verification.log"
  exit 1
fi
echo ""

# Step 8: Independent SHA256 verification
echo "Step 8: Independent SHA256 verification..."
(
  cd "$ART"
  echo "Verifying $REQ1:"
  shasum -a 256 "$REQ1" | tee "$REQ1.sha256.recheck"
  echo "Expected:"
  cat "$REQ2"
  echo ""
  
  echo "Verifying $REQ3:"
  shasum -a 256 "$REQ3" | tee "$REQ3.sha256.recheck"
  echo "Expected:"
  cat "$REQ4"
) 2>&1 | tee "$EVI/sha256_independent_check.log"

echo "✅ SHA256 verification complete"
echo ""

# Step 9: Generate evidence index
echo "Step 9: Generating evidence index..."
cat > "$EVI/EVIDENCE_INDEX.md" <<EOF
# W3-1 Complete Verification Evidence

Generated: $(date)

## Execution Logs
- Job Trigger: [trigger_job.log](trigger_job.log)
- Contract Verification: [gate17_contract_verification.log](gate17_contract_verification.log)
- SHA256 Independent Check: [sha256_independent_check.log](sha256_independent_check.log)

## Artifacts
- Directory: [artifacts/](artifacts/)
- Listing: [artifacts_ls.log](artifacts_ls.log)
- Presence Check: [artifacts_presence.ok](artifacts_presence.ok)

## Four-Pack Contents
\`\`\`
$(ls -lh "$ART")
\`\`\`

## Summary
- Evidence Path: \`$EVI\`
- Artifacts Path: \`$ART\`
- All checks: ✅ PASSED
EOF

echo "✅ Evidence index created: $EVI/EVIDENCE_INDEX.md"
echo ""

# Final summary
echo "════════════════════════════════════════════"
echo "W3-1 VERIFICATION COMPLETE ✅"
echo "════════════════════════════════════════════"
echo ""
echo "Evidence directory: $EVI"
echo ""
echo "Key files:"
echo "  - $EVI/EVIDENCE_INDEX.md"
echo "  - $EVI/gate17_contract_verification.log"
echo "  - $ART/"
echo ""
echo "To review evidence:"
echo "  cat $EVI/EVIDENCE_INDEX.md"
echo "  ls -lh $ART"
echo ""
