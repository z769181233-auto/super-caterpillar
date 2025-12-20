#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

source "$ROOT/tools/dev/_lib/evidence_pipe.sh"

{
  echo "=== Evidence Output Best Practices ==="
  echo ""
  echo "1. File paths (not full contents):"
  printf "   - %s\n" \
    "docs/_evidence/phaseD/INDEX.md" \
    "docs/_evidence/feature_phase_gate_20251219.md" \
    "tools/dev/deprecation_guard.sh"

  echo ""
  echo "2. Snippets when needed (head 40):"
  echo "   INDEX.md (head 40):"
  sed -n "1,40p" docs/_evidence/phaseD/INDEX.md 2>/dev/null || echo "   (file not found)"

  echo ""
  echo "3. Script location only (no full content):"
  echo "   deprecation_guard.sh: tools/dev/deprecation_guard.sh"
  echo "   deprecation_guard.sh (head 20):"
  sed -n "1,20p" tools/dev/deprecation_guard.sh 2>/dev/null || echo "   (file not found)"

  echo ""
  echo "=== Anti-patterns to avoid ==="
  echo "❌ cat docs/_evidence/phaseD/INDEX.md"
  echo "❌ cat tools/dev/deprecation_guard.sh"
  echo "❌ for f in docs/_evidence/phaseD/*.md; do cat \"\$f\"; done"
  echo ""
  echo "✅ Use paths + snippets instead"
} | evidence_pipe "/tmp/evidence_output_guidelines.log" >/dev/null

echo ""
echo "✓ Output passed deduplication and sanity checks"
cat /tmp/evidence_output_guidelines.log

