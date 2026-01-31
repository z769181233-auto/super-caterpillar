#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_p7_lib.sh"
need_env P7_DEPLOY_GREEN_CMD
run_cmd "P7-DEPLOY-GREEN" "$P7_DEPLOY_GREEN_CMD"
