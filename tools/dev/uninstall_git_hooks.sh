#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_DIR="$ROOT/.git/hooks"

rm -f "$HOOK_DIR/pre-commit" "$HOOK_DIR/pre-push"
echo "[DONE] removed pre-commit and pre-push hooks"

