#!/bin/bash
# tools/gate/scripts/dump-db-facts-p13-2.sh
set -e

EVIDENCE_DIR=${EVIDENCE_DIR:-"docs/_evidence/P13_2_AUDIO_GATE_PASS"}
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/scu"}

mkdir -p "$EVIDENCE_DIR"

echo "[DUMP] Dumping DB facts to $EVIDENCE_DIR"

# 1. Assets Schema
psql "$DATABASE_URL" -c "\d+ assets" > "$EVIDENCE_DIR/db_assets_schema.txt"

# 2. Shots Schema
psql "$DATABASE_URL" -c "\d+ shots" > "$EVIDENCE_DIR/db_shots_schema.txt"

# 3. BillingOutbox (Case-sensitive check)
if psql "$DATABASE_URL" -t -c "SELECT to_regclass('public.\"BillingOutbox\"');" | grep -q "BillingOutbox"; then
    psql "$DATABASE_URL" -c "\d+ \"BillingOutbox\"" > "$EVIDENCE_DIR/db_billing_outbox_schema.txt"
else
    echo "NOT_FOUND" > "$EVIDENCE_DIR/db_billing_outbox_schema.txt"
fi

# 4. Asset Constraints
psql "$DATABASE_URL" -c "
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM
    pg_constraint c
JOIN
    pg_class t ON c.conrelid = t.oid
WHERE
    t.relname = 'assets';
" > "$EVIDENCE_DIR/db_asset_constraints.txt"

# 5. AssetType Enums
psql "$DATABASE_URL" -c "
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'AssetType'
ORDER BY enumlabel;
" > "$EVIDENCE_DIR/db_enum_assettype.txt"

# 6. AssetOwnerType Enums
psql "$DATABASE_URL" -c "
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'AssetOwnerType'
ORDER BY enumlabel;
" > "$EVIDENCE_DIR/db_enum_assetownertype.txt"

echo "[DUMP] Done. Generated 6 files in $EVIDENCE_DIR"
