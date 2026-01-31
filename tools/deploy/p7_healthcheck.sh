#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_p7_lib.sh"

TARGET="${1:-}"
case "$TARGET" in
  blue)
    need_env P7_HEALTHCHECK_URL_BLUE
    http_healthcheck "$P7_HEALTHCHECK_URL_BLUE" "P7-HEALTH-BLUE"
    ;;
  green)
    need_env P7_HEALTHCHECK_URL_GREEN
    http_healthcheck "$P7_HEALTHCHECK_URL_GREEN" "P7-HEALTH-GREEN"
    ;;
  live)
    need_env P7_HEALTHCHECK_URL_LIVE
    http_healthcheck "$P7_HEALTHCHECK_URL_LIVE" "P7-HEALTH-LIVE"
    ;;
  *)
    die "usage: p7_healthcheck.sh {blue|green|live}"
    ;;
esac
