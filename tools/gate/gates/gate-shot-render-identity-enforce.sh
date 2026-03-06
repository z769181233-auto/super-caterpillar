#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE: Shot Render Identity Enforce
# Output: EVIDENCE_INDEX.json (with sha256)

EVD_DIR=$(cat .current_evidence_dir)
LOG_FILE="$EVD_DIR/GATE_IDENTITY_ENFORCE.log"
exec > >(tee -a "$LOG_FILE") 2>&1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

echo "[GATE] Starting Shot Render Identity Gate at $(date)"

# 1. Run TS Runner
echo "[GATE] Running Logic Test..."
# Use ts-node from root
./node_modules/.bin/ts-node tools/gate/runners/run-shot-render-identity.ts

RUN_EXIT_CODE=$?
if [ $RUN_EXIT_CODE -ne 0 ]; then
  echo "[GATE] ❌ Logic Test Failed"
  exit $RUN_EXIT_CODE
fi

# 2. Verify Audit Log Persistence (SQL)
echo "[GATE] Verifying Audit Log in DB..."
SQL_OUT="$EVD_DIR/AUDIT_IDENTITY_FIELDS.sql.out"
# Use psql via docker/local
# Assuming DATABASE_URL env or default
DB_NAME="scu" 
psql -d $DB_NAME -f tools/gate/sql/audit_identity_fields.sql > "$SQL_OUT"

if grep -q "identity_info" "$SQL_OUT"; then
    echo "[GATE] ✅ Audit fields detected in SQL output."
else
    echo "[GATE] ❌ Audit fields MISSING in SQL output."
    cat "$SQL_OUT"
    exit 1
fi

# 3. Generate SHA256 Evidence Index (Python)
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
