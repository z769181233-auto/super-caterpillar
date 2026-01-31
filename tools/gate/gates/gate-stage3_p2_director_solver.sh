#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p2_director_solver_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_DIRECTOR] Starting Gate Verification..."

log "🧪 Running director solver gate script..."
export EVID_DIR="$EVID_DIR"
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_director_solver_gate.ts > "$EVID_DIR/run.log" 2>&1

log "✅ Gate Passed. Evidence at $EVID_DIR"
ls -la "$EVID_DIR" | tee -a "$EVID_DIR/gate.log"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p2_director_solver_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_DIRECTOR] Starting Gate Verification..."

log "🧪 Running director solver gate script..."
export EVID_DIR="$EVID_DIR"
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_director_solver_gate.ts > "$EVID_DIR/run.log" 2>&1

log "✅ Gate Passed. Evidence at $EVID_DIR"
ls -la "$EVID_DIR" | tee -a "$EVID_DIR/gate.log"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p2_director_solver_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_DIRECTOR] Starting Gate Verification..."

log "🧪 Running director solver gate script..."
export EVID_DIR="$EVID_DIR"
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_director_solver_gate.ts > "$EVID_DIR/run.log" 2>&1

log "✅ Gate Passed. Evidence at $EVID_DIR"
ls -la "$EVID_DIR" | tee -a "$EVID_DIR/gate.log"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p2_director_solver_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_DIRECTOR] Starting Gate Verification..."

log "🧪 Running director solver gate script..."
export EVID_DIR="$EVID_DIR"
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_director_solver_gate.ts > "$EVID_DIR/run.log" 2>&1

log "✅ Gate Passed. Evidence at $EVID_DIR"
ls -la "$EVID_DIR" | tee -a "$EVID_DIR/gate.log"
