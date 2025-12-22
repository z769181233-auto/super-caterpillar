#!/usr/bin/env bash
set -euo pipefail

bash docs/_evidence/_tools/check_canonical_workspace.sh >/dev/null

echo "[canonical] PASS: safe to generate authoritative verification evidence"
