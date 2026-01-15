#!/usr/bin/env bash
set -euo pipefail

# Evidence wrapper: delegate to authoritative repo tool
if [ -f "tools/dev/deprecation_guard.sh" ]; then
  bash tools/dev/deprecation_guard.sh
else
  echo "[deprecation_guard(wrapper)] FAIL: tools/dev/deprecation_guard.sh missing" >&2
  exit 1
fi
