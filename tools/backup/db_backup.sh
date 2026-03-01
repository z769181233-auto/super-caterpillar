#!/bin/bash
set -euo pipefail

if [[ "${DATABASE_URL:-}" != *"localhost"* && "${DATABASE_URL:-}" != *"127.0.0.1"* ]]; then
  echo "❌ REFUSE TO RUN ON NON-LOCAL DATABASE"
  exit 99
fi

# P1-2: Database Backup Script
# 清洗DATABASE_URL,使用custom format,生成checksum

# 清洗DATABASE_URL (去掉?参数,避免schema等问题)
DB_URL_CLEAN="${DATABASE_URL%%\?*}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".data/backups"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.dump"

echo "[BACKUP] Starting backup at $TIMESTAMP..."

# 使用custom format (更稳定)
pg_dump -Fc "$DB_URL_CLEAN" > "$BACKUP_FILE"

# 压缩+checksum
gzip "$BACKUP_FILE"
CHECKSUM=$(shasum -a 256 "$BACKUP_FILE.gz" | awk '{print $1}')

# 元数据
cat > "$BACKUP_DIR/backup_$TIMESTAMP.meta.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "file": "$BACKUP_FILE.gz",
  "checksum": "$CHECKSUM",
  "database_url": "***REDACTED***"
}
EOF

echo "[BACKUP] Backup完成: $BACKUP_FILE.gz (checksum: $CHECKSUM)"
