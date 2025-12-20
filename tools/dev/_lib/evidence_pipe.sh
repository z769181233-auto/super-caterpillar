#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root robustly.
_evidence_repo_root() {
  local root=""
  if command -v git >/dev/null 2>&1; then
    root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  fi
  if [[ -z "$root" ]]; then
    # fallback: this file is tools/dev/_lib/evidence_pipe.sh
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  fi
  echo "$root"
}

# evidence_pipe:
#   Reads from stdin, enforces dedupe + tee log + sanity_check, then emits sanitized output to stdout.
# Usage:
#   { producer; } | evidence_pipe "/tmp/some.log" >> report.md
evidence_pipe() {
  local log_path="${1:-}"
  local root
  root="$(_evidence_repo_root)"

  # repo-local tmp (policy-aligned)
  local tmp_dir="${root}/.tmp/evidence"
  mkdir -p "${tmp_dir}"

  if [[ -z "$log_path" ]]; then
    local base
    base="$(basename "${0:-evidence}")"
    base="${base%.*}"
    log_path="${tmp_dir}/${base}.log"
  else
    # if caller passes relative path, anchor to repo-local tmp
    if [[ "$log_path" != /* ]]; then
      log_path="${tmp_dir}/${log_path}"
    fi
    mkdir -p "$(dirname "$log_path")"
  fi

  local dedupe="${root}/tools/dev/_lib/dedupe_print.sh"
  local sanity="${root}/tools/dev/_lib/evidence_output_sanity_check.sh"

  # 1) read stdin -> dedupe -> write log (do NOT echo to stdout here)
  cat \
    | "${dedupe}" \
    | tee "${log_path}" >/dev/null

  # 2) sanity check on the log (stderr only on failure)
  cat "${log_path}" | "${sanity}"

  # 3) emit sanitized output exactly once
  cat "${log_path}"
}

# evidence_run:
#   Runs a command and pipes its stdout through evidence_pipe.
# Usage:
#   evidence_run "/tmp/some.log" bash -lc '...'
evidence_run() {
  local log_path="${1:-}"
  shift || true
  "$@" | evidence_pipe "${log_path}"
}

