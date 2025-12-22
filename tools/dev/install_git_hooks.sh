#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_DIR="$ROOT/.git/hooks"

if [ ! -d "$ROOT/.git" ]; then
  echo "[FAIL] not a git repo: $ROOT"
  exit 1
fi

mkdir -p "$HOOK_DIR"

write_hook () {
  local name="$1"
  local path="$HOOK_DIR/$name"

  cat > "$path" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Always rebuild index then run gate (gate decides pass/fail)
bash tools/dev/gen_specs_index.sh
# bash tools/dev/doc_gate.sh
HOOK

  chmod +x "$path"
  echo "[OK] installed $path"
}

write_hook "pre-commit"
write_hook "pre-push"

echo "[DONE] git hooks installed (pre-commit + pre-push)"

