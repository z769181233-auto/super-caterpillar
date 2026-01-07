#!/bin/bash
set -e
set -o pipefail

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
    log "❌ CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be 'false' in .env.local to prevent regression!"
    exit 1
fi

log "✅ Topology Check: Internal Worker disabled."
# Note: We rely on the external worker being started by the user/system (already running in parallel terminal)


# 1. Seeding Data (Using P2-3 logic)
log "🌱 Seeding project and novel source..."
export PROJECT_ID="proj-p1b-audit"
export NOVEL_SOURCE_ID="ns-p1b-audit"

# Strip query parameters for psql (avoids "invalid URI query parameter: schema" error)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*//')

# Use psql for seeding
psql "$DB_URL_CLEAN" -c "DELETE FROM projects WHERE id='$PROJECT_ID';" > /dev/null 2>&1 || true
psql "$DB_URL_CLEAN" <<EOF
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES ('user-p1b', 'audit-test@example.com', 'hash', NOW()) ON CONFLICT DO NOTHING;
INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES ('org-p1b', 'P1B Org', 'user-p1b', NOW()) ON CONFLICT DO NOTHING;
INSERT INTO projects (id, name, "organizationId", "ownerId", status, "updatedAt") VALUES ('$PROJECT_ID', 'Audit Test Project', 'org-p1b', 'user-p1b', 'in_progress', NOW());
INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES ('season-p1b', '$PROJECT_ID', 1, 'Season 1', NOW()) ON CONFLICT DO NOTHING;
INSERT INTO episodes (id, "seasonId", index, name) VALUES ('ep-p1b', 'season-p1b', 1, 'Episode 1') ON CONFLICT DO NOTHING;
INSERT INTO scenes (id, "episodeId", index, title, summary) VALUES ('scene-p1b', 'ep-p1b', 1, 'Scene 1', 'Neon city sunset analysis summary.') ON CONFLICT DO NOTHING;
INSERT INTO shots (id, "sceneId", index, type, "organizationId") VALUES ('shot-p1b-audit', 'scene-p1b', 1, 'SCENE', 'org-p1b') ON CONFLICT DO NOTHING;
INSERT INTO novel_sources (id, "projectId", "rawText", "updatedAt") VALUES ('$NOVEL_SOURCE_ID', '$PROJECT_ID', 'In a futuristic city, a neon sign flickers. The camera glides through the rainy street. High visual density and rich enrichment keywords: cinematic, lighting, motion, atmosphere.', NOW());
INSERT INTO api_keys (id, "ownerOrgId", key, "secretHash", name, status, "updatedAt") VALUES ('key-p1b', 'org-p1b', 'ak-p1b', 'as-p1b', 'Audit Gate Key', 'ACTIVE', NOW()) ON CONFLICT DO NOTHING;

INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES ('eng_ce06_global', 'ce06_novel_parsing', 'HttpAdapter', 'HTTP', '{}', true, NOW(), NOW(), 'ce06_novel_parsing', true, 'Novel Parsing', 'ANALYSIS') ON CONFLICT DO NOTHING;
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES ('eng_ce03_global', 'ce03_visual_density', 'VisualDensityLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce03_visual_density', true, 'Visual Density', 'ANALYSIS') ON CONFLICT DO NOTHING;
INSERT INTO engines (id, "engineKey", "adapterName", "adapterType", config, enabled, "createdAt", "updatedAt", code, "isActive", name, type) VALUES ('eng_ce04_global', 'ce04_visual_enrichment', 'VisualEnrichmentLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce04_visual_enrichment', true, 'Visual Enrichment', 'ANALYSIS') ON CONFLICT DO NOTHING;

INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES ('ver_ce06_global', 'eng_ce06_global', '1.0.0', '{}', true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES ('ver_ce03_global', 'eng_ce03_global', '1.0.0', '{}', true, NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO engine_versions (id, "engineId", "versionName", config, enabled, "createdAt", "updatedAt") VALUES ('ver_ce04_global', 'eng_ce04_global', '1.0.0', '{}', true, NOW(), NOW()) ON CONFLICT DO NOTHING;
EOF

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
