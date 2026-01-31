#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE: Identity Consistency Check (Audit Based)
# Output: AUDIT_IDENTITY_CONSISTENCY.sql.out, EVIDENCE_INDEX.json

EVD_DIR=$(cat .current_evidence_dir)
LOG_FILE="$EVD_DIR/GATE_IDENTITY_CONSISTENCY.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[GATE] Starting Consistency Gate at $(date)"

# 1. Run Consistency Runner
echo "[GATE] Running Runner..."
./node_modules/.bin/ts-node tools/gate/runners/run-identity-consistency.ts

IDS_FILE="$EVD_DIR/SHOT_RENDER_JOB_IDS.txt"
if [ ! -f "$IDS_FILE" ]; then
    echo "[GATE] ❌ Job IDs file not found!"
    exit 1
fi

JOB1=$(sed -n '1p' "$IDS_FILE")
JOB2=$(sed -n '2p' "$IDS_FILE")

echo "[GATE] Captured Jobs: $JOB1, $JOB2"

# 2. Prepare & Execution SQL
SQL_TEMPLATE="tools/gate/sql/audit_identity_consistency.sql"
SQL_RUN="$EVD_DIR/consistency_query.sql"
sed "s/__JOB1__/$JOB1/g; s/__JOB2__/$JOB2/g" "$SQL_TEMPLATE" > "$SQL_RUN"

SQL_OUT="$EVD_DIR/AUDIT_IDENTITY_CONSISTENCY.sql.out"
# Use DATABASE_URL if present, else default
DB_NAME="scu"
# Simple check for env
if [ -z "${DATABASE_URL:-}" ]; then
    echo "[GATE] DATABASE_URL not set, using default dbname=$DB_NAME"
    CMD="psql -d $DB_NAME"
else
    echo "[GATE] Using DATABASE_URL connection..."
    CMD="psql $DATABASE_URL"
fi

$CMD -f "$SQL_RUN" > "$SQL_OUT"
# Print for log
cat "$SQL_OUT"

# 3. Assert Consistency
# Expected format of SQL Output (psql default):
#  job_id | char_id | anchor_id | seed | view_hash 
# --------+---------+-----------+------+-----------
#  ...    | ...     | ...       | ...  | ...
# (2 rows)

# Extract Data Rows (skip header/footer)
# We use awk to grab specific columns and check uniq counts
# Columns: 3(anchor), 4(seed), 5(view_hash) - assuming standard table format
# It is safer to use Copy format or CSV, but let's try parsing standard output first.
# Anchor ID is column 3 (indices depend on | separator).
# job_id | char_ | anchor_ | seed | view_
#   1    |   2   |    3    |   4  |   5

echo "[GATE] Verifying Consistency..."

ANCHOR_COUNT=$(grep -v "rows)" "$SQL_OUT" | grep "|" | grep -v "job_id" | awk -F '|' '{print $3}' | sed 's/ //g' | sort | uniq | wc -l | xargs)
SEED_COUNT=$(grep -v "rows)" "$SQL_OUT" | grep "|" | grep -v "job_id" | awk -F '|' '{print $4}' | sed 's/ //g' | sort | uniq | wc -l | xargs)
HASH_COUNT=$(grep -v "rows)" "$SQL_OUT" | grep "|" | grep -v "job_id" | awk -F '|' '{print $5}' | sed 's/ //g' | sort | uniq | wc -l | xargs)

ROW_COUNT=$(grep -v "rows)" "$SQL_OUT" | grep "|" | grep -v "job_id" | wc -l | xargs)

if [ "$ROW_COUNT" -ne 2 ]; then
    echo "[GATE] ❌ Expected 2 rows, got $ROW_COUNT"
    exit 1
fi

if [ "$ANCHOR_COUNT" -eq 1 ] && [ "$SEED_COUNT" -eq 1 ] && [ "$HASH_COUNT" -eq 1 ]; then
    echo "[GATE] ✅ Consistency Verified: Anchor/Seed/Hash are identical across $ROW_COUNT jobs."
else
    echo "[GATE] ❌ Consistency Failure!"
    echo "Anchor Unique Count: $ANCHOR_COUNT (Expected 1)"
    echo "Seed Unique Count: $SEED_COUNT (Expected 1)"
    echo "Hash Unique Count: $HASH_COUNT (Expected 1)"
    exit 1
fi

# 4. Generate SHA256 Index
echo "[GATE] Generating SHA256 Evidence Index..."
export EVD="$EVD_DIR"
python3 -c '
import hashlib, json, os
root=os.environ["EVD"]
out=[]
for dirpath,_,files in os.walk(root):
    for fn in sorted(files):
        if fn == "EVIDENCE_INDEX.json": continue
        p=os.path.join(dirpath,fn)
        h=hashlib.sha256(open(p,"rb").read()).hexdigest()
        out.append({"path":os.path.relpath(p,root),"sha256":h})
with open(os.path.join(root,"EVIDENCE_INDEX.json"),"w") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"Index generated with {len(out)} files.")
'

echo "[GATE] Success"
