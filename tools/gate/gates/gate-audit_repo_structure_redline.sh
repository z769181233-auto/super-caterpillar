#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

CONFIG="docs/_specs/governance/gov_post_sealed.config.json"

fail() { echo "[STRUCTURE][FAIL] $*" >&2; exit 1; }
pass() { echo "[STRUCTURE][PASS] $*"; }

[[ -f "$CONFIG" ]] || fail "Missing config: $CONFIG"

# minimal json reader (支持字符串与对象混排)
req_dirs=$(node -e "const c=require('./$CONFIG'); console.log(c.required_dirs.join('\n'))")
req_files=$(node -e "const c=require('./$CONFIG'); console.log(c.required_files.map(x => typeof x === 'string' ? x : x.script).join('\n'))")
dir_regex=$(node -e "const c=require('./$CONFIG'); console.log(c.evidence.run_dir_prefix + '_' + '.*')")

while read -r d; do
  [[ -z "$d" ]] && continue
  [[ -d "$d" ]] || fail "Missing required dir: $d"
done <<<"$req_dirs"

while read -r f; do
  [[ -z "$f" ]] && continue
  [[ -f "$f" ]] || fail "Missing required file: $f"
done <<<"$req_files"

# evidence dir naming sanity check
if [[ -d "docs/_evidence" ]]; then
  while read -r ed; do
    [[ -z "$ed" ]] && continue
    base="$(basename "$ed")"
    [[ "$base" =~ $dir_regex ]] || fail "Illegal evidence dir name: $ed (regex=$dir_regex)"
  done < <(find docs/_evidence -mindepth 1 -maxdepth 1 -type d 2>/dev/null || true)
fi

pass "Repo structure and SSOT config present; evidence dirs conform (if any)."
