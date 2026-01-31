#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# gate-stage3-0_mock_audit.sh
# Stage 3 Negative Audit: Identifies all Mock/Stub/Placeholder implementations 
# in the production pipeline (CE06 -> CE03 -> CE04 -> SHOT_RENDER).

source "$(dirname "$0")/../common/load_env.sh"

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/stage3_mock_audit_${TS}"
mkdir -p "$EVID"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/audit.log"; }

log "🚀 [Stage 3] Starting Mock/Stub Discovery Audit..."

# 1. Scanning directories
SCAN_TARGETS=("apps/workers/src" "apps/api/src/ce-engine" "apps/api/src/novel-import")
PATTERNS=("Mock" "Stub" "Placeholder" "testsrc" "basicTextSegmentation" "placeholder.png")

log "Scanning: ${SCAN_TARGETS[*]} for patterns: ${PATTERNS[*]}"

# Generate JSON Report via Node
REPORT_JSON=$(node -e const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const targets = ["apps/workers/src", "apps/api/src/ce-engine", "apps/api/src/novel-import"];
const patterns = ["Mock", "Stub", "Placeholder", "testsrc", "basicTextSegmentation", "placeholder.png"];

const results = [];

targets.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  patterns.forEach(p => {
    try {
      const output = execSync($(grep -rnE "${p}" "${dir}" --exclude-dir=node_modules || true)).toString();
      output.split("\n").filter(Boolean).forEach(line => {
        const [file, lnum, ...rest] = line.split(":");
        results.push({ file, line: lnum, pattern: p, content: rest.join(":").trim() });
      });
    } catch(e) {}
  });
});

console.log(JSON.stringify(results, null, 2));

echo "$REPORT_JSON" > "$EVID/mock_inventory.json"
MOCK_COUNT=$(echo "$REPORT_JSON" | node -e 
log "Found $MOCK_COUNT potential Mock/Stub instances."

# 2. Map to Core Engines
log "== Mapping to Core Engine Spec =="
REPORT_MD="$EVID/REPORT.md"
cat > "$REPORT_MD" <<EOF
# Stage 3 Mock/Stub Audit Report
- Timestamp: ${TS}
- Total Findings: ${MOCK_COUNT}

## Core Engine Gap Matrix
| Engine | Status | Evidence | Gap Type |
| :--- | :--- | :--- | :--- |
| CE06 (Novel Analysis) | ⚠️ STUB | apps/workers/src/ce-core-processor.ts | basicTextSegmentation |
| CE03 (Visual Density) | ⚠️ MOCK | apps/workers/src/adapters/ | simple keywords match |
| CE04 (Visual Enrichment) | ⚠️ MOCK | apps/workers/src/adapters/ | placeholder scores |
| SHOT_RENDER | ❌ MOCK | apps/workers/src/adapters/ | placeholder.png generated |
| VIDEO_RENDER | ✅ REAL | apps/workers/src/video-render.processor.ts | FFmpeg Integration |

## Raw Findings List
EOF

echo "$REPORT_JSON" | node -e const data = JSON.parse(fs.readFileSync(0));
data.forEach(d => {
  console.log($(- **[${d.pattern}]** \)${d.file}:${d.line}\$(: \)${d.content.slice(0, 100)}\``);
})

log "✅ Audit Complete. Report: ${REPORT_MD}"

# Safety Gate: If this were a blocking gate, we would exit 1 if core engines were mock.
# For now, it is an INFORMATION GATE to drive Stage 3.
exit 0

# gate-stage3-0_mock_audit.sh
# Stage 3 Negative Audit: Identifies all Mock/Stub/Placeholder implementations 
# in the production pipeline (CE06 -> CE03 -> CE04 -> SHOT_RENDER).

source "$(dirname "$0")/../common/load_env.sh"

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/stage3_mock_audit_${TS}"
mkdir -p "$EVID"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/audit.log"; }

log "🚀 [Stage 3] Starting Mock/Stub Discovery Audit..."

# 1. Scanning directories
SCAN_TARGETS=("apps/workers/src" "apps/api/src/ce-engine" "apps/api/src/novel-import")
PATTERNS=("Mock" "Stub" "Placeholder" "testsrc" "basicTextSegmentation" "placeholder.png")

log "Scanning: ${SCAN_TARGETS[*]} for patterns: ${PATTERNS[*]}"

# Generate JSON Report via Node
REPORT_JSON=$(node -e const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const targets = ["apps/workers/src", "apps/api/src/ce-engine", "apps/api/src/novel-import"];
const patterns = ["Mock", "Stub", "Placeholder", "testsrc", "basicTextSegmentation", "placeholder.png"];

const results = [];

targets.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  patterns.forEach(p => {
    try {
      const output = execSync($(grep -rnE "${p}" "${dir}" --exclude-dir=node_modules || true)).toString();
      output.split("\n").filter(Boolean).forEach(line => {
        const [file, lnum, ...rest] = line.split(":");
        results.push({ file, line: lnum, pattern: p, content: rest.join(":").trim() });
      });
    } catch(e) {}
  });
});

console.log(JSON.stringify(results, null, 2));

echo "$REPORT_JSON" > "$EVID/mock_inventory.json"
MOCK_COUNT=$(echo "$REPORT_JSON" | node -e 
log "Found $MOCK_COUNT potential Mock/Stub instances."

# 2. Map to Core Engines
log "== Mapping to Core Engine Spec =="
REPORT_MD="$EVID/REPORT.md"
cat > "$REPORT_MD" <<EOF
# Stage 3 Mock/Stub Audit Report
- Timestamp: ${TS}
- Total Findings: ${MOCK_COUNT}

## Core Engine Gap Matrix
| Engine | Status | Evidence | Gap Type |
| :--- | :--- | :--- | :--- |
| CE06 (Novel Analysis) | ⚠️ STUB | apps/workers/src/ce-core-processor.ts | basicTextSegmentation |
| CE03 (Visual Density) | ⚠️ MOCK | apps/workers/src/adapters/ | simple keywords match |
| CE04 (Visual Enrichment) | ⚠️ MOCK | apps/workers/src/adapters/ | placeholder scores |
| SHOT_RENDER | ❌ MOCK | apps/workers/src/adapters/ | placeholder.png generated |
| VIDEO_RENDER | ✅ REAL | apps/workers/src/video-render.processor.ts | FFmpeg Integration |

## Raw Findings List
EOF

echo "$REPORT_JSON" | node -e const data = JSON.parse(fs.readFileSync(0));
data.forEach(d => {
  console.log($(- **[${d.pattern}]** \)${d.file}:${d.line}\$(: \)${d.content.slice(0, 100)}\``);
})

log "✅ Audit Complete. Report: ${REPORT_MD}"

# Safety Gate: If this were a blocking gate, we would exit 1 if core engines were mock.
# For now, it is an INFORMATION GATE to drive Stage 3.
exit 0

# gate-stage3-0_mock_audit.sh
# Stage 3 Negative Audit: Identifies all Mock/Stub/Placeholder implementations 
# in the production pipeline (CE06 -> CE03 -> CE04 -> SHOT_RENDER).

source "$(dirname "$0")/../common/load_env.sh"

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/stage3_mock_audit_${TS}"
mkdir -p "$EVID"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/audit.log"; }

log "🚀 [Stage 3] Starting Mock/Stub Discovery Audit..."

# 1. Scanning directories
SCAN_TARGETS=("apps/workers/src" "apps/api/src/ce-engine" "apps/api/src/novel-import")
PATTERNS=("Mock" "Stub" "Placeholder" "testsrc" "basicTextSegmentation" "placeholder.png")

log "Scanning: ${SCAN_TARGETS[*]} for patterns: ${PATTERNS[*]}"

# Generate JSON Report via Node
REPORT_JSON=$(node -e const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const targets = ["apps/workers/src", "apps/api/src/ce-engine", "apps/api/src/novel-import"];
const patterns = ["Mock", "Stub", "Placeholder", "testsrc", "basicTextSegmentation", "placeholder.png"];

const results = [];

targets.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  patterns.forEach(p => {
    try {
      const output = execSync($(grep -rnE "${p}" "${dir}" --exclude-dir=node_modules || true)).toString();
      output.split("\n").filter(Boolean).forEach(line => {
        const [file, lnum, ...rest] = line.split(":");
        results.push({ file, line: lnum, pattern: p, content: rest.join(":").trim() });
      });
    } catch(e) {}
  });
});

console.log(JSON.stringify(results, null, 2));

echo "$REPORT_JSON" > "$EVID/mock_inventory.json"
MOCK_COUNT=$(echo "$REPORT_JSON" | node -e 
log "Found $MOCK_COUNT potential Mock/Stub instances."

# 2. Map to Core Engines
log "== Mapping to Core Engine Spec =="
REPORT_MD="$EVID/REPORT.md"
cat > "$REPORT_MD" <<EOF
# Stage 3 Mock/Stub Audit Report
- Timestamp: ${TS}
- Total Findings: ${MOCK_COUNT}

## Core Engine Gap Matrix
| Engine | Status | Evidence | Gap Type |
| :--- | :--- | :--- | :--- |
| CE06 (Novel Analysis) | ⚠️ STUB | apps/workers/src/ce-core-processor.ts | basicTextSegmentation |
| CE03 (Visual Density) | ⚠️ MOCK | apps/workers/src/adapters/ | simple keywords match |
| CE04 (Visual Enrichment) | ⚠️ MOCK | apps/workers/src/adapters/ | placeholder scores |
| SHOT_RENDER | ❌ MOCK | apps/workers/src/adapters/ | placeholder.png generated |
| VIDEO_RENDER | ✅ REAL | apps/workers/src/video-render.processor.ts | FFmpeg Integration |

## Raw Findings List
EOF

echo "$REPORT_JSON" | node -e const data = JSON.parse(fs.readFileSync(0));
data.forEach(d => {
  console.log($(- **[${d.pattern}]** \)${d.file}:${d.line}\$(: \)${d.content.slice(0, 100)}\``);
})

log "✅ Audit Complete. Report: ${REPORT_MD}"

# Safety Gate: If this were a blocking gate, we would exit 1 if core engines were mock.
# For now, it is an INFORMATION GATE to drive Stage 3.
exit 0

# gate-stage3-0_mock_audit.sh
# Stage 3 Negative Audit: Identifies all Mock/Stub/Placeholder implementations 
# in the production pipeline (CE06 -> CE03 -> CE04 -> SHOT_RENDER).

source "$(dirname "$0")/../common/load_env.sh"

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/stage3_mock_audit_${TS}"
mkdir -p "$EVID"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/audit.log"; }

log "🚀 [Stage 3] Starting Mock/Stub Discovery Audit..."

# 1. Scanning directories
SCAN_TARGETS=("apps/workers/src" "apps/api/src/ce-engine" "apps/api/src/novel-import")
PATTERNS=("Mock" "Stub" "Placeholder" "testsrc" "basicTextSegmentation" "placeholder.png")

log "Scanning: ${SCAN_TARGETS[*]} for patterns: ${PATTERNS[*]}"

# Generate JSON Report via Node
REPORT_JSON=$(node -e const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const targets = ["apps/workers/src", "apps/api/src/ce-engine", "apps/api/src/novel-import"];
const patterns = ["Mock", "Stub", "Placeholder", "testsrc", "basicTextSegmentation", "placeholder.png"];

const results = [];

targets.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  patterns.forEach(p => {
    try {
      const output = execSync($(grep -rnE "${p}" "${dir}" --exclude-dir=node_modules || true)).toString();
      output.split("\n").filter(Boolean).forEach(line => {
        const [file, lnum, ...rest] = line.split(":");
        results.push({ file, line: lnum, pattern: p, content: rest.join(":").trim() });
      });
    } catch(e) {}
  });
});

console.log(JSON.stringify(results, null, 2));

echo "$REPORT_JSON" > "$EVID/mock_inventory.json"
MOCK_COUNT=$(echo "$REPORT_JSON" | node -e 
log "Found $MOCK_COUNT potential Mock/Stub instances."

# 2. Map to Core Engines
log "== Mapping to Core Engine Spec =="
REPORT_MD="$EVID/REPORT.md"
cat > "$REPORT_MD" <<EOF
# Stage 3 Mock/Stub Audit Report
- Timestamp: ${TS}
- Total Findings: ${MOCK_COUNT}

## Core Engine Gap Matrix
| Engine | Status | Evidence | Gap Type |
| :--- | :--- | :--- | :--- |
| CE06 (Novel Analysis) | ⚠️ STUB | apps/workers/src/ce-core-processor.ts | basicTextSegmentation |
| CE03 (Visual Density) | ⚠️ MOCK | apps/workers/src/adapters/ | simple keywords match |
| CE04 (Visual Enrichment) | ⚠️ MOCK | apps/workers/src/adapters/ | placeholder scores |
| SHOT_RENDER | ❌ MOCK | apps/workers/src/adapters/ | placeholder.png generated |
| VIDEO_RENDER | ✅ REAL | apps/workers/src/video-render.processor.ts | FFmpeg Integration |

## Raw Findings List
EOF

echo "$REPORT_JSON" | node -e const data = JSON.parse(fs.readFileSync(0));
data.forEach(d => {
  console.log($(- **[${d.pattern}]** \)${d.file}:${d.line}\$(: \)${d.content.slice(0, 100)}\``);
})

log "✅ Audit Complete. Report: ${REPORT_MD}"

# Safety Gate: If this were a blocking gate, we would exit 1 if core engines were mock.
# For now, it is an INFORMATION GATE to drive Stage 3.
exit 0
