#!/bin/bash
# tools/gate/lib/gate_auth_seed.sh (STABILIZED)
set -euo pipefail

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [SEED] $1" >&2
}

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL not set."
  exit 1
fi

# 1. Initialize API Key (Get Valid Key/Secret)
log "Initializing API Credentials..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1) || { log "Init Failed"; echo "$INIT_OUT"; exit 1; }
VALID_API_KEY_ID=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2)
API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2)

if [ -z "$VALID_API_KEY_ID" ] || [ -z "$API_SECRET" ]; then
    log "Error: Failed to fetch API Key."
    exit 1
fi

# 2. Use Stable IDs for Gate Process
ORG_ID="gate_org_p25_stable"
USER_ID="gate_user_p25_stable"
USER_EMAIL="gate_p25@caterpillar.com"
TS_SEED=$(date +%s)

export VALID_API_KEY_ID API_SECRET ORG_ID USER_ID

# 3. Seed Database with Sequential Integrity
log "Seeding Stable DB Hierarchy..."

psql -v ON_ERROR_STOP=1 "$DATABASE_URL" <<EOF
-- 0. RBAC Baseline (Robust)
INSERT INTO "roles" ("id", "name", "level", "createdAt", "updatedAt") 
VALUES ('role_admin', 'admin', 999, NOW(), NOW()) 
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "permissions" ("id", "key", "scope", "createdAt", "updatedAt") 
VALUES ('perm_auth', 'auth', 'system', NOW(), NOW()) 
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "permissions" ("id", "key", "scope", "createdAt", "updatedAt") 
VALUES ('perm_proj_create', 'project.create', 'system', NOW(), NOW()) 
ON CONFLICT ("key") DO NOTHING;

-- Link logic using subqueries to handle existing IDs
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_admin_auth', r.id, p.id, NOW()
FROM "roles" r, "permissions" p
WHERE r.name = 'admin' AND p.key = 'auth'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_admin_proj_fix', r.id, p.id, NOW()
FROM "roles" r, "permissions" p
WHERE r.name = 'admin' AND p.key = 'project.create'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 0.5 Cleanup Stable User Artifacts (Cascade Manual)
DELETE FROM "Task" WHERE "organizationId" IN (SELECT id FROM "organizations" WHERE "ownerId"='$USER_ID');
DELETE FROM "shot_jobs" WHERE "organizationId" IN (SELECT id FROM "organizations" WHERE "ownerId"='$USER_ID');
DELETE FROM "shots" WHERE "organizationId" IN (SELECT id FROM "organizations" WHERE "ownerId"='$USER_ID');

-- Deep cleanup for Projects (Scenes/Episodes/Novels)
DELETE FROM "scenes" WHERE "episodeId" IN (SELECT id FROM "episodes" WHERE "projectId" IN (SELECT id FROM "projects" WHERE "ownerId"='$USER_ID'));
DELETE FROM "episodes" WHERE "projectId" IN (SELECT id FROM "projects" WHERE "ownerId"='$USER_ID');
DELETE FROM "novels" WHERE "project_id" IN (SELECT id FROM "projects" WHERE "ownerId"='$USER_ID');
DELETE FROM "projects" WHERE "ownerId"='$USER_ID';

-- Org cleanup
DELETE FROM "memberships" WHERE "userId"='$USER_ID';
DELETE FROM "organization_members" WHERE "userId"='$USER_ID';
DELETE FROM "organizations" WHERE "ownerId"='$USER_ID';
-- User cleanup skippable as we upset it below

-- 1. Identity Infrastructure
INSERT INTO "users" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt") 
VALUES ('$USER_ID', '$USER_EMAIL', 'hash', 'ADMIN', NOW(), NOW()) ON CONFLICT ("id") DO UPDATE SET "role"='ADMIN';

INSERT INTO "organizations" ("id", "name", "ownerId", "createdAt", "updatedAt") 
VALUES ('$ORG_ID', 'Stable Gate Org', '$USER_ID', NOW(), NOW()) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "organization_members" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
VALUES ('om_$USER_ID', '$USER_ID', '$ORG_ID', 'ADMIN', NOW(), NOW()) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "permissions", "createdAt", "updatedAt")
VALUES ('ms_$USER_ID', '$USER_ID', '$ORG_ID', 'ADMIN', '["project.create"]'::jsonb, NOW(), NOW()) ON CONFLICT ("id") DO NOTHING;

-- 2. Link API Key
UPDATE "api_keys" SET "ownerUserId"='$USER_ID', "ownerOrgId"='$ORG_ID' WHERE "key"='$VALID_API_KEY_ID';

-- 3. Cleanup existing projects from this stable user to avoid leaks
-- DELETE FROM "projects" WHERE "ownerId"='$USER_ID';
EOF

log "DB Seeding Complete. ORG_ID=$ORG_ID"
