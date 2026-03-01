#!/bin/bash
IFS=$'
	'
set -e

# Orchestrator V2: Audio Integration L3 Manifest Gate
# Hard Assertions for CID/Evidence/Integrity

EVI_DIR="docs/_evidence/orch_v2_audio_l3_20260126_221019"
MANIFEST="docs/ORCH_V2_AUDIO_L3_MANIFEST.json"
MANIFEST_SHA_FILE="$EVI_DIR/l3_manifest_sha256.txt"

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${YELLOW}[GATE-L3]${NC} $1"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

log "Starting L3 Manifest Verification Gate..."

# 1. Manifest Hash Verification
log "Verifying Manifest SHA256 integrity..."
ACTUAL_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')
EXPECTED_SHA=$(cat "$MANIFEST_SHA_FILE" | awk '{print $1}')

if [ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]; then
    ok "Manifest Hash Match: $ACTUAL_SHA"
else
    fail "Manifest Hash Mismatch! Actual: $ACTUAL_SHA, Expected: $EXPECTED_SHA"
fi

# 2. Terminology Check (HMAC_V2) in Manifest
log "Checking Terminology in Manifest..."
if grep -q "HMAC_V2" "$MANIFEST"; then
    ok "HMAC_V2 Found in Manifest."
else
    fail "HMAC_V2 Not Found in Manifest! Terminology check failed."
fi

# 3. Fingerprint Consistency Check
log "Checking Fingerprint Consistency Result..."
COMPARE_FILE="$EVI_DIR/fingerprint_compare.json"
if [ ! -f "$COMPARE_FILE" ]; then fail "Fingerprint compare file missing!"; fi
MATCH_STATUS=$(grep "\"match\":" "$COMPARE_FILE" | awk -F: '{print $2}' | tr -d ' ,')
if [ "$MATCH_STATUS" == "true" ]; then
    ok "Double PASS Verification: Fingerprints MATCHED."
else
    fail "Double PASS Verification: Fingerprints MISMATCHED!"
fi

# 4. AuthTerm Log Evidence Verification
log "Verifying AuthTerm in Evidence Logs..."
if grep -q "HMAC_V2" "$EVI_DIR/R1/api.log" || grep -q "HMAC_V2" "$EVI_DIR/patch_hmac_term_unify.diff"; then
    ok "AuthTerm Evidence Found (HMAC_V2)."
else
    fail "AuthTerm Evidence Missing! Logs do not show HMAC_V2 usage."
fi

# 5. Manifest Structure Check
log "Verifying Manifest Structure..."
REQUIRED_FIELDS=("manifestLevel" "gitSha" "orchestratorRules" "security" "enforcementPoints" "engineBindings" "fingerprints")
for FIELD in "${REQUIRED_FIELDS[@]}"; do
    if grep -q "$FIELD" "$MANIFEST"; then
        continue
    else
        fail "Required field '$FIELD' missing from Manifest!"
    fi
done
ok "Manifest structure is valid."

log "=============================================="
log "🎉 GATE PASS: Orchestrator V2 Audio L3 Manifest Certified"
log "=============================================="
