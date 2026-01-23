#!/bin/bash
set -euo pipefail

API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="CE23_IDENTITY_REAL"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ce23_identity_real_$TS"
mkdir -p "$EVIDENCE_DIR"

log(){ echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"; }

log "Starting CE23 REAL gate..."
source tools/gate/lib/gate_auth_seed.sh

# TODO: enable project flag: ce23RealEnabled=true
# TODO: prepare 1 anchor + 5 targets (copy deterministic files or render mock)
# TODO: call /api/_internal/ce23/score-and-record with HMAC headers (reuse generate_headers pattern)
# TODO: assert min(score) >= 0.80 and Double PASS stability
# TODO: dump evidence + SHA256SUMS

log "SCAFFOLD ONLY (expected to fail until implemented)."
exit 1
