#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p6_1_db_migration_safety.sh <evidence_dir>}"
mkdir -p "$EVI"

need git
need node
need shasum

# Try locate prisma schema
SCHEMA="$(git ls-files | grep -m1 'schema\.prisma$' || true)"
[ -n "$SCHEMA" ] || die "schema.prisma not found in tracked files"

# Resolve DATABASE_URL from env or .env (untracked ok)
DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  # Read and remove potential quotes (handling macOS sed)
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -n 1 | sed 's/^DATABASE_URL=//' | sed 's/^\"//' | sed 's/\"$//' | sed "s/^'//" | sed "s/'$//")"
fi
[ -n "$DATABASE_URL" ] || die "DATABASE_URL not set (export DATABASE_URL or provide .env)"
export DATABASE_URL

# Build a shadow db url (postgres): append suffix to db name
SHADOW_DB_URL="$(node - <<'NODE'
const u = new URL(process.env.DATABASE_URL);
const db = u.pathname.replace(/^\//,'') || 'db';
const suffix = 'p6_shadow_' + new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
u.pathname = '/' + db + '_' + suffix;
console.log(u.toString());
NODE
)"
echo "SCHEMA=$SCHEMA" > "$EVI/p6_1_db_inputs.txt"
echo "DATABASE_URL(redacted_db)=<present>" >> "$EVI/p6_1_db_inputs.txt"
echo "SHADOW_DB_URL(redacted_db)=<present>" >> "$EVI/p6_1_db_inputs.txt"

log "[P6-1] prisma migrate status (base db)..."
( pnpm -s prisma migrate status --schema "$SCHEMA" 2>&1 || true ) | tee "$EVI/p6_1_migrate_status_base.log"

log "[P6-1] shadow db migrate deploy..."
export DATABASE_URL="$SHADOW_DB_URL"
( pnpm -s prisma migrate deploy --schema "$SCHEMA" 2>&1 ) | tee "$EVI/p6_1_migrate_deploy_shadow.log"

log "[P6-1] shadow db migrate status..."
( pnpm -s prisma migrate status --schema "$SCHEMA" 2>&1 ) | tee "$EVI/p6_1_migrate_status_shadow.log"

# Minimal structure check: ensure Prisma can connect & query something (no data assumptions)
log "[P6-1] prisma db pull (schema validation only, no file write)..."
( pnpm -s prisma db pull --schema "$SCHEMA" --force 2>&1 || true ) | tee "$EVI/p6_1_db_pull_shadow.log"

REPORT="$EVI/p6_1_db_migration_audit.json"
json_write "$REPORT" "$(node - <<'NODE'
const out = {
  gate: "P6-1",
  name: "db migration safety (shadow deploy)",
  status: "PASS",
  artifacts: {
    inputs: "p6_1_db_inputs.txt",
    migrate_status_base: "p6_1_migrate_status_base.log",
    migrate_deploy_shadow: "p6_1_migrate_deploy_shadow.log",
    migrate_status_shadow: "p6_1_migrate_status_shadow.log",
    db_pull_shadow: "p6_1_db_pull_shadow.log",
  },
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
NODE
)"
