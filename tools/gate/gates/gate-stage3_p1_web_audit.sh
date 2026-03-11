#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# P1-B Correction: Standardize to 3001
export API_PORT=3001
export API_URL="http://127.0.0.1:$API_PORT/api"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_web_audit_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P1-B Web-Audit] Starting Visibility Closure Gate..."

# 0. Anti-Regression: Check Worker Topology (Internal disabled, External enabled)
if ! grep -q "ENABLE_INTERNAL_JOB_WORKER=false" .env.local; then
    log "❌ CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be     exit 1
fi

log "✅ Topology Check: Internal Worker disabled."
# Note: We rely on the external worker being started by the user/system (already running in parallel terminal)


# 1. Seeding Data (Using P2-3 logic)
log "🌱 Seeding project and novel source..."
export PROJECT_ID="proj-p1b-audit"
export NOVEL_SOURCE_ID="ns-p1b-audit"

# Strip query parameters for psql (avoids "invalid URI query parameter: schema" error)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 
# Use psql for seeding
psql "$DB_URL_CLEAN" -c "DELETE FROM projects WHERE id=psql "$DB_URL_CLEAN" <<EOF # $gate$
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES (INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES (INSERT INTO projects (id, name, "organizationId", "ownerId", status, "updatedAt") VALUES (INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES (INSERT INTO episodes (id, "seasonId", index, name) VALUES (INSERT INTO scenes (id, "episodeId", index, title, summary) VALUES (INSERT INTO shots (id, "sceneId", index, type, "organizationId") VALUES (INSERT INTO novel_sources (id, "projectId", "rawText", "updatedAt") VALUES (INSERT INTO api_keys (id, "ownerOrgId", key, "secretHash", name, status, "updatedAt") VALUES (
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (EOF

log "✅ Seed completed."

# 2. Trigger DAG and Verify via full API
log "🧪 Running apps/api/src/scripts/p1_web_audit_gate.ts..."
export PROJECT_ID="$PROJECT_ID"
export NOVEL_SOURCE_ID="$NOVEL_SOURCE_ID"
export EVID_DIR="$EVID_DIR"
export API_KEY="ak-p1b"
export API_SECRET="as-p1b"

npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_web_audit_gate.ts | tee -a "$EVID_DIR/run.log"

log "✅ Gate Passed. Evidence at $EVID_DIR"
cat "$EVID_DIR/FINAL_REPORT.md" || echo "=== Evidence generated ==="
set -e

# P1-B: Web-Audit Visibility Closure Hardpass Gate
# 功能：验证聚合审计接口数据准确性，确保 P2 产出在 Web 可见且满足商用标准。

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
# P1-B Correction: Standardize to 3001
export API_PORT=3001
export API_URL="http://127.0.0.1:$API_PORT/api"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_web_audit_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P1-B Web-Audit] Starting Visibility Closure Gate..."

# 0. Anti-Regression: Check Worker Topology (Internal disabled, External enabled)
if ! grep -q "ENABLE_INTERNAL_JOB_WORKER=false" .env.local; then
    log "❌ CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be     exit 1
fi

log "✅ Topology Check: Internal Worker disabled."
# Note: We rely on the external worker being started by the user/system (already running in parallel terminal)


# 1. Seeding Data (Using P2-3 logic)
log "🌱 Seeding project and novel source..."
export PROJECT_ID="proj-p1b-audit"
export NOVEL_SOURCE_ID="ns-p1b-audit"

# Strip query parameters for psql (avoids "invalid URI query parameter: schema" error)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 
# Use psql for seeding
psql "$DB_URL_CLEAN" -c "DELETE FROM projects WHERE id=psql "$DB_URL_CLEAN" <<EOF # $gate$
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES (INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES (INSERT INTO projects (id, name, "organizationId", "ownerId", status, "updatedAt") VALUES (INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES (INSERT INTO episodes (id, "seasonId", index, name) VALUES (INSERT INTO scenes (id, "episodeId", index, title, summary) VALUES (INSERT INTO shots (id, "sceneId", index, type, "organizationId") VALUES (INSERT INTO novel_sources (id, "projectId", "rawText", "updatedAt") VALUES (INSERT INTO api_keys (id, "ownerOrgId", key, "secretHash", name, status, "updatedAt") VALUES (
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (EOF

log "✅ Seed completed."

# 2. Trigger DAG and Verify via full API
log "🧪 Running apps/api/src/scripts/p1_web_audit_gate.ts..."
export PROJECT_ID="$PROJECT_ID"
export NOVEL_SOURCE_ID="$NOVEL_SOURCE_ID"
export EVID_DIR="$EVID_DIR"
export API_KEY="ak-p1b"
export API_SECRET="as-p1b"

npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_web_audit_gate.ts | tee -a "$EVID_DIR/run.log"

log "✅ Gate Passed. Evidence at $EVID_DIR"
cat "$EVID_DIR/FINAL_REPORT.md" || echo "=== Evidence generated ==="
set -e

# P1-B: Web-Audit Visibility Closure Hardpass Gate
# 功能：验证聚合审计接口数据准确性，确保 P2 产出在 Web 可见且满足商用标准。

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
# P1-B Correction: Standardize to 3001
export API_PORT=3001
export API_URL="http://127.0.0.1:$API_PORT/api"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_web_audit_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P1-B Web-Audit] Starting Visibility Closure Gate..."

# 0. Anti-Regression: Check Worker Topology (Internal disabled, External enabled)
if ! grep -q "ENABLE_INTERNAL_JOB_WORKER=false" .env.local; then
    log "❌ CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be     exit 1
fi

log "✅ Topology Check: Internal Worker disabled."
# Note: We rely on the external worker being started by the user/system (already running in parallel terminal)


# 1. Seeding Data (Using P2-3 logic)
log "🌱 Seeding project and novel source..."
export PROJECT_ID="proj-p1b-audit"
export NOVEL_SOURCE_ID="ns-p1b-audit"

# Strip query parameters for psql (avoids "invalid URI query parameter: schema" error)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 
# Use psql for seeding
psql "$DB_URL_CLEAN" -c "DELETE FROM projects WHERE id=psql "$DB_URL_CLEAN" <<EOF # $gate$
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES (INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES (INSERT INTO projects (id, name, "organizationId", "ownerId", status, "updatedAt") VALUES (INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES (INSERT INTO episodes (id, "seasonId", index, name) VALUES (INSERT INTO scenes (id, "episodeId", index, title, summary) VALUES (INSERT INTO shots (id, "sceneId", index, type, "organizationId") VALUES (INSERT INTO novel_sources (id, "projectId", "rawText", "updatedAt") VALUES (INSERT INTO api_keys (id, "ownerOrgId", key, "secretHash", name, status, "updatedAt") VALUES (
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (EOF

log "✅ Seed completed."

# 2. Trigger DAG and Verify via full API
log "🧪 Running apps/api/src/scripts/p1_web_audit_gate.ts..."
export PROJECT_ID="$PROJECT_ID"
export NOVEL_SOURCE_ID="$NOVEL_SOURCE_ID"
export EVID_DIR="$EVID_DIR"
export API_KEY="ak-p1b"
export API_SECRET="as-p1b"

npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_web_audit_gate.ts | tee -a "$EVID_DIR/run.log"

log "✅ Gate Passed. Evidence at $EVID_DIR"
cat "$EVID_DIR/FINAL_REPORT.md" || echo "=== Evidence generated ==="
set -e

# P1-B: Web-Audit Visibility Closure Hardpass Gate
# 功能：验证聚合审计接口数据准确性，确保 P2 产出在 Web 可见且满足商用标准。

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
# P1-B Correction: Standardize to 3001
export API_PORT=3001
export API_URL="http://127.0.0.1:$API_PORT/api"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_web_audit_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P1-B Web-Audit] Starting Visibility Closure Gate..."

# 0. Anti-Regression: Check Worker Topology (Internal disabled, External enabled)
if ! grep -q "ENABLE_INTERNAL_JOB_WORKER=false" .env.local; then
    log "❌ CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be     exit 1
fi

log "✅ Topology Check: Internal Worker disabled."
# Note: We rely on the external worker being started by the user/system (already running in parallel terminal)


# 1. Seeding Data (Using P2-3 logic)
log "🌱 Seeding project and novel source..."
export PROJECT_ID="proj-p1b-audit"
export NOVEL_SOURCE_ID="ns-p1b-audit"

# Strip query parameters for psql (avoids "invalid URI query parameter: schema" error)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 
# Use psql for seeding
psql "$DB_URL_CLEAN" -c "DELETE FROM projects WHERE id=psql "$DB_URL_CLEAN" <<EOF # $gate$
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES (INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES (INSERT INTO projects (id, name, "organizationId", "ownerId", status, "updatedAt") VALUES (INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES (INSERT INTO episodes (id, "seasonId", index, name) VALUES (INSERT INTO scenes (id, "episodeId", index, title, summary) VALUES (INSERT INTO shots (id, "sceneId", index, type, "organizationId") VALUES (INSERT INTO novel_sources (id, "projectId", "rawText", "updatedAt") VALUES (INSERT INTO api_keys (id, "ownerOrgId", key, "secretHash", name, status, "updatedAt") VALUES (
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES (
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES (EOF

log "✅ Seed completed."

# 2. Trigger DAG and Verify via full API
log "🧪 Running apps/api/src/scripts/p1_web_audit_gate.ts..."
export PROJECT_ID="$PROJECT_ID"
export NOVEL_SOURCE_ID="$NOVEL_SOURCE_ID"
export EVID_DIR="$EVID_DIR"
export API_KEY="ak-p1b"
export API_SECRET="as-p1b"

npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_web_audit_gate.ts | tee -a "$EVID_DIR/run.log"

log "✅ Gate Passed. Evidence at $EVID_DIR"
cat "$EVID_DIR/FINAL_REPORT.md" || echo "=== Evidence generated ==="
