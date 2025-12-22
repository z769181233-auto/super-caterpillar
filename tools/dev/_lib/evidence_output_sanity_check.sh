#!/usr/bin/env bash
set -euo pipefail

# Evidence output must not dump full script bodies repeatedly.
# We detect repeated shebangs in the stream (stdin).
# If count > 1, likely concatenated scripts / duplicated dumps.

SHEBANGS="$(grep -cE '^#!' || true)"
if [ "${SHEBANGS}" -gt 1 ]; then
  echo "[evidence_output] FAIL: detected repeated script body dump (shebang count=${SHEBANGS})." >&2
  exit 1
fi

