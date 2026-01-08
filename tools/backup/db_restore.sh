#!/bin/bash
set -euo pipefail

if [[ "${DATABASE_URL:-}" != *"localhost"* && "${DATABASE_URL:-}" != *"127.0.0.1"* ]]; then
  echo "❌ REFUSE TO RUN ON NON-LOCAL DATABASE"
  exit 99
fi

# P1-2: Database Restore Script
# 从custom format备份恢复数据库

BACKUP_FILE="$1"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup_file.dump.gz>" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

DB_URL_CLEAN="${DATABASE_URL%%\?*}"

echo "[RESTORE] Starting restore from $BACKUP_FILE..."

# 解压
gunzip -c "$BACKUP_FILE" > /tmp/restore.dump

# 恢复 (custom format)
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$DB_URL_CLEAN" /tmp/restore.dump

rm /tmp/restore.dump

echo "[RESTORE] Restore完成"
