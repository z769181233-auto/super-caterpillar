#!/usr/bin/env bash
set -euo pipefail

# Common env loader for gates
export API_PORT="${API_PORT:-3001}"
export API_URL="${API_URL:-http://127.0.0.1:$API_PORT}"

ENV_FILE="${ENV_FILE:-.env.local}"

load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0

  # Read line-by-line to safely handle spaces without xargs splitting
  while IFS= read -r line || [ -n "$line" ]; do
    # trim leading spaces
    line="${line#"${line%%[![:space:]]*}"}"

    # skip empty and full-line comment
    [[ -z "$line" ]] && continue
    [[ "${line:0:1}" == "#" ]] && continue

    # drop inline comments only when preceded by space (to avoid breaking URLs with #)
    # Example: KEY=value # comment
    if [[ "$line" == *" #"* ]]; then
      line="${line%% \#*}"
    fi

    # allow optional leading 'export '
    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="${line#"${line%%[![:space:]]*}"}"
    fi

    # must contain '='
    [[ "$line" != *"="* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"

    # trim trailing spaces from key
    key="${key%"${key##*[![:space:]]}"}"
    # trim leading spaces from key
    key="${key#"${key%%[![:space:]]*}"}"

    # basic key validation: [A-Za-z_][A-Za-z0-9_]*
    if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "[load_env] skip invalid key: $key" >&2
      continue
    fi

    # If value is quoted, strip matching quotes (preserve inner spaces)
    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file"
}

load_env_file "$ENV_FILE"
