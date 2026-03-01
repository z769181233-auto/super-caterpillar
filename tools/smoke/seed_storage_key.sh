#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

STORAGE_ROOT="${STORAGE_ROOT:-$ROOT/.data/storage}"
mkdir -p "$STORAGE_ROOT"

TS="$(date +%s)"
KEY="temp/gates/${TS}/probe.txt"
ABS_PATH="$STORAGE_ROOT/$KEY"

mkdir -p "$(dirname "$ABS_PATH")"
echo "gate storage probe ${TS}" > "$ABS_PATH"

echo "$KEY"

