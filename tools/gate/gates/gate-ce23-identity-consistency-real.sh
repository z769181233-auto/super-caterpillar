#!/bin/bash
set -euo pipefail
GATE_NAME="CE23_IDENTITY_REAL"
API_URL=${API_URL:-"http://localhost:3000"}
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ce23_identity_real_$TS"
mkdir -p "$EVIDENCE_DIR"

log(){ echo "[\$GATE_NAME] \$1" | tee -a "\$EVIDENCE_DIR/GATE_RUN.log"; }

log "TODO: seed + generate 5 shots + call /api/_internal/ce23/score-and-record + assert min score >= 0.80"
log "TODO: dump scores.csv + embeddings_hash.txt + SHA256SUMS.txt"
exit 1
