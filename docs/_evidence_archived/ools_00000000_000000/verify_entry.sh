#!/usr/bin/env bash
set -euo pipefail

# Hard prerequisite: canonical workspace only
bash "$(dirname "$0")/require_canonical_or_exit.sh"

# Optional: also run canonical gate for explicit evidence
bash "$(dirname "$0")/check_canonical_workspace.sh"

# Deprecation guard: prevent reintroduction of removed items
bash "$(dirname "$0")/deprecation_guard.sh"
