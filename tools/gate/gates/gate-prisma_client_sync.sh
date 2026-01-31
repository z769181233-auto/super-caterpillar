#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# Prisma Client Sync Gate
# Goal: Ensure Prisma Client is generated and consistent with current schema.

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/prisma_sync_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [Prisma Sync] Starting Force Generation..."

# 1. Force Generate
pnpm --filter database prisma:generate | tee -a "$EVID_DIR/generate.log"

# 2. Check Existence
CLIENT_PATH="packages/database/src/generated/prisma/index.js"
if [ -f "$CLIENT_PATH" ]; then
    log "✅ Prisma Client found at $CLIENT_PATH"
else
    log "❌ Prisma Client MISSING at $CLIENT_PATH"
    exit 1
fi

# 3. Schema Hash (Optional but good for SSOT)
SCHEMA_HASH=$(shasum packages/database/prisma/schema.prisma | awk log "Schema Hash: $SCHEMA_HASH"
echo "$SCHEMA_HASH" > "$EVID_DIR/schema.hash"

log "✅ Prisma Sync Gate PASSED."
set -e

# Prisma Client Sync Gate
# Goal: Ensure Prisma Client is generated and consistent with current schema.

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/prisma_sync_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [Prisma Sync] Starting Force Generation..."

# 1. Force Generate
pnpm --filter database prisma:generate | tee -a "$EVID_DIR/generate.log"

# 2. Check Existence
CLIENT_PATH="packages/database/src/generated/prisma/index.js"
if [ -f "$CLIENT_PATH" ]; then
    log "✅ Prisma Client found at $CLIENT_PATH"
else
    log "❌ Prisma Client MISSING at $CLIENT_PATH"
    exit 1
fi

# 3. Schema Hash (Optional but good for SSOT)
SCHEMA_HASH=$(shasum packages/database/prisma/schema.prisma | awk log "Schema Hash: $SCHEMA_HASH"
echo "$SCHEMA_HASH" > "$EVID_DIR/schema.hash"

log "✅ Prisma Sync Gate PASSED."
set -e

# Prisma Client Sync Gate
# Goal: Ensure Prisma Client is generated and consistent with current schema.

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/prisma_sync_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [Prisma Sync] Starting Force Generation..."

# 1. Force Generate
pnpm --filter database prisma:generate | tee -a "$EVID_DIR/generate.log"

# 2. Check Existence
CLIENT_PATH="packages/database/src/generated/prisma/index.js"
if [ -f "$CLIENT_PATH" ]; then
    log "✅ Prisma Client found at $CLIENT_PATH"
else
    log "❌ Prisma Client MISSING at $CLIENT_PATH"
    exit 1
fi

# 3. Schema Hash (Optional but good for SSOT)
SCHEMA_HASH=$(shasum packages/database/prisma/schema.prisma | awk log "Schema Hash: $SCHEMA_HASH"
echo "$SCHEMA_HASH" > "$EVID_DIR/schema.hash"

log "✅ Prisma Sync Gate PASSED."
set -e

# Prisma Client Sync Gate
# Goal: Ensure Prisma Client is generated and consistent with current schema.

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/prisma_sync_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [Prisma Sync] Starting Force Generation..."

# 1. Force Generate
pnpm --filter database prisma:generate | tee -a "$EVID_DIR/generate.log"

# 2. Check Existence
CLIENT_PATH="packages/database/src/generated/prisma/index.js"
if [ -f "$CLIENT_PATH" ]; then
    log "✅ Prisma Client found at $CLIENT_PATH"
else
    log "❌ Prisma Client MISSING at $CLIENT_PATH"
    exit 1
fi

# 3. Schema Hash (Optional but good for SSOT)
SCHEMA_HASH=$(shasum packages/database/prisma/schema.prisma | awk log "Schema Hash: $SCHEMA_HASH"
echo "$SCHEMA_HASH" > "$EVID_DIR/schema.hash"

log "✅ Prisma Sync Gate PASSED."
