#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p6_2_observability_required.sh <evidence_dir>}"
mkdir -p "$EVI"

need git
need node

log "[P6-2] scan for metrics endpoint/instrumentation..."
METRICS_HINTS="$(git grep -nE '(/metrics\b|prom-client|Prometheus|Histogram\(|Summary\(|Counter\()' -- apps packages 2>/dev/null | head -n 200 || true)"
printf "%s\n" "$METRICS_HINTS" > "$EVI/p6_2_metrics_hints_sample.txt"

log "[P6-2] scan for request correlation id / trace id..."
TRACE_HINTS="$(git grep -nE '(requestId|x-request-id|traceId|x-trace-id|correlationId|x-correlation-id)' -- apps packages 2>/dev/null | head -n 200 || true)"
printf "%s\n" "$TRACE_HINTS" > "$EVI/p6_2_trace_hints_sample.txt"

if [ ! -s "$EVI/p6_2_metrics_hints_sample.txt" ]; then
  log "[P6-2] FAIL: no metrics instrumentation hints found in apps/packages"
  exit 1
fi
if [ ! -s "$EVI/p6_2_trace_hints_sample.txt" ]; then
  log "[P6-2] FAIL: no requestId/traceId correlation hints found in apps/packages"
  exit 1
fi

REPORT="$EVI/p6_2_observability_audit.json"
json_write "$REPORT" "$(node - <<'NODE'
const out = {
  gate: "P6-2",
  name: "observability required (static proof)",
  status: "PASS",
  artifacts: {
    metrics_hints_sample: "p6_2_metrics_hints_sample.txt",
    trace_hints_sample: "p6_2_trace_hints_sample.txt",
  },
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
NODE
)"
