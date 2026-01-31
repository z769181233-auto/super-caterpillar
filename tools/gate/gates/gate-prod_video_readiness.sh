#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# gate-prod_video_readiness.sh
# Phase 0-R Total Gate (Commercial Grade)

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVIDENCE_DIR="docs/_evidence/PROD_VIDEO_READINESS_${TIMESTAMP}"
API_URL=${API_URL:-"http://localhost:3000"}

mkdir -p "${EVIDENCE_DIR}"
rm -rf .gate_evidence && mkdir -p .gate_evidence
mkdir -p .gate_evidence/shot_images

echo "===================================================="
echo " PHASE 0-R: PRODUCTION VIDEO READINESS (COMPREHENSIVE)"
echo " Started at: $(date)"
echo "===================================================="

# 1. Negative Tests (Lock-Down Verification)
FAILED=0

echo ""
echo ">>> NEGATIVE-1: Router Anti-Fallback (No Token)"
( unset REPLICATE_API_TOKEN; export SHOT_RENDER_PROVIDER=replicate; \
  res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_1\"}"); \
  if [ "$res" == "400" ] || [ "$res" == "500" ]; then echo "INTERCEPTED ($res)"; else echo "FAIL (Allowed $res)"; exit 1; fi ) || FAILED=1

echo ""
echo ">>> NEGATIVE-2: Retry Limit (attempt > 3)"
# Manual trigger through admin gate with high attempt
res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_2\",\"jobId\":\"retry_test\",\"attempt\":4}")
if [ "$res" == "400" ] || [ "$res" == "500" ]; then 
  echo "INTERCEPTED ($res): Retry limit enforced."
else 
  echo "FAIL ($res): Retry limit ignored."
  FAILED=1
fi

if [ $FAILED -ne 0 ]; then
  echo "ERROR: Negative tests failed. Logic lockdown is not effective."
  exit 1
fi

# 2. Positive Tests
echo ""
echo ">>> POSITIVE-1: Shot Render Realness..."
bash tools/gate/gates/gate-prod_shot_render_real.sh || FAILED=1

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-2: Video MP4 Validity..."
  bash tools/gate/gates/gate-prod_video_mp4_valid.sh || FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-3: E2E Pipeline..."
  bash tools/gate/gates/gate-prod_e2e_novel_to_video.sh || FAILED=1
fi

# 3. Archive & Summary
if [ $FAILED -eq 0 ]; then
  echo ""
  echo "--- Archiving Standard Evidence ---"
  
  # Standardize directory structure
  mv .gate_evidence/shot_render/input.json "${EVIDENCE_DIR}/input.json" || true
  mv .gate_evidence/shot_render/assets.json "${EVIDENCE_DIR}/assets.json" || true
  mv .gate_evidence/video_valid/ffprobe.json "${EVIDENCE_DIR}/ffprobe.json" || true
  mv .gate_evidence/video_sample.mp4 "${EVIDENCE_DIR}/video.mp4" || true
  mv .gate_evidence/shot_images "${EVIDENCE_DIR}/shot_images" || true
  
  # Generate Summary
  cat > "${EVIDENCE_DIR}/summary.md" <<EOF
# Phase 0-R Production Readiness Summary
- **Timestamp**: $TIMESTAMP
- **Status**: SUCCESS (Hard Locked)
- **Lockdown Checks**:
    - [x] Router Anti-Fallback (Negative Test Passed)
    - [x] Retry Limit <= 3 (Negative Test Passed)
    - [x] Real SHA256 Verification (Passed)
    - [x] FFmpeg MP4 Validation (Passed)
- **Commit SHA**: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
EOF

  echo "===================================================="
  echo " SUCCESS: PHASE 0-R LOCK-DOWN COMPLETE"
  echo " Evidence: ${EVIDENCE_DIR}"
  echo "===================================================="
else
  exit 1
fi

# gate-prod_video_readiness.sh
# Phase 0-R Total Gate (Commercial Grade)

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVIDENCE_DIR="docs/_evidence/PROD_VIDEO_READINESS_${TIMESTAMP}"
API_URL=${API_URL:-"http://localhost:3000"}

mkdir -p "${EVIDENCE_DIR}"
rm -rf .gate_evidence && mkdir -p .gate_evidence
mkdir -p .gate_evidence/shot_images

echo "===================================================="
echo " PHASE 0-R: PRODUCTION VIDEO READINESS (COMPREHENSIVE)"
echo " Started at: $(date)"
echo "===================================================="

# 1. Negative Tests (Lock-Down Verification)
FAILED=0

echo ""
echo ">>> NEGATIVE-1: Router Anti-Fallback (No Token)"
( unset REPLICATE_API_TOKEN; export SHOT_RENDER_PROVIDER=replicate; \
  res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_1\"}"); \
  if [ "$res" == "400" ] || [ "$res" == "500" ]; then echo "INTERCEPTED ($res)"; else echo "FAIL (Allowed $res)"; exit 1; fi ) || FAILED=1

echo ""
echo ">>> NEGATIVE-2: Retry Limit (attempt > 3)"
# Manual trigger through admin gate with high attempt
res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_2\",\"jobId\":\"retry_test\",\"attempt\":4}")
if [ "$res" == "400" ] || [ "$res" == "500" ]; then 
  echo "INTERCEPTED ($res): Retry limit enforced."
else 
  echo "FAIL ($res): Retry limit ignored."
  FAILED=1
fi

if [ $FAILED -ne 0 ]; then
  echo "ERROR: Negative tests failed. Logic lockdown is not effective."
  exit 1
fi

# 2. Positive Tests
echo ""
echo ">>> POSITIVE-1: Shot Render Realness..."
bash tools/gate/gates/gate-prod_shot_render_real.sh || FAILED=1

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-2: Video MP4 Validity..."
  bash tools/gate/gates/gate-prod_video_mp4_valid.sh || FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-3: E2E Pipeline..."
  bash tools/gate/gates/gate-prod_e2e_novel_to_video.sh || FAILED=1
fi

# 3. Archive & Summary
if [ $FAILED -eq 0 ]; then
  echo ""
  echo "--- Archiving Standard Evidence ---"
  
  # Standardize directory structure
  mv .gate_evidence/shot_render/input.json "${EVIDENCE_DIR}/input.json" || true
  mv .gate_evidence/shot_render/assets.json "${EVIDENCE_DIR}/assets.json" || true
  mv .gate_evidence/video_valid/ffprobe.json "${EVIDENCE_DIR}/ffprobe.json" || true
  mv .gate_evidence/video_sample.mp4 "${EVIDENCE_DIR}/video.mp4" || true
  mv .gate_evidence/shot_images "${EVIDENCE_DIR}/shot_images" || true
  
  # Generate Summary
  cat > "${EVIDENCE_DIR}/summary.md" <<EOF
# Phase 0-R Production Readiness Summary
- **Timestamp**: $TIMESTAMP
- **Status**: SUCCESS (Hard Locked)
- **Lockdown Checks**:
    - [x] Router Anti-Fallback (Negative Test Passed)
    - [x] Retry Limit <= 3 (Negative Test Passed)
    - [x] Real SHA256 Verification (Passed)
    - [x] FFmpeg MP4 Validation (Passed)
- **Commit SHA**: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
EOF

  echo "===================================================="
  echo " SUCCESS: PHASE 0-R LOCK-DOWN COMPLETE"
  echo " Evidence: ${EVIDENCE_DIR}"
  echo "===================================================="
else
  exit 1
fi

# gate-prod_video_readiness.sh
# Phase 0-R Total Gate (Commercial Grade)

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVIDENCE_DIR="docs/_evidence/PROD_VIDEO_READINESS_${TIMESTAMP}"
API_URL=${API_URL:-"http://localhost:3000"}

mkdir -p "${EVIDENCE_DIR}"
rm -rf .gate_evidence && mkdir -p .gate_evidence
mkdir -p .gate_evidence/shot_images

echo "===================================================="
echo " PHASE 0-R: PRODUCTION VIDEO READINESS (COMPREHENSIVE)"
echo " Started at: $(date)"
echo "===================================================="

# 1. Negative Tests (Lock-Down Verification)
FAILED=0

echo ""
echo ">>> NEGATIVE-1: Router Anti-Fallback (No Token)"
( unset REPLICATE_API_TOKEN; export SHOT_RENDER_PROVIDER=replicate; \
  res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_1\"}"); \
  if [ "$res" == "400" ] || [ "$res" == "500" ]; then echo "INTERCEPTED ($res)"; else echo "FAIL (Allowed $res)"; exit 1; fi ) || FAILED=1

echo ""
echo ">>> NEGATIVE-2: Retry Limit (attempt > 3)"
# Manual trigger through admin gate with high attempt
res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_2\",\"jobId\":\"retry_test\",\"attempt\":4}")
if [ "$res" == "400" ] || [ "$res" == "500" ]; then 
  echo "INTERCEPTED ($res): Retry limit enforced."
else 
  echo "FAIL ($res): Retry limit ignored."
  FAILED=1
fi

if [ $FAILED -ne 0 ]; then
  echo "ERROR: Negative tests failed. Logic lockdown is not effective."
  exit 1
fi

# 2. Positive Tests
echo ""
echo ">>> POSITIVE-1: Shot Render Realness..."
bash tools/gate/gates/gate-prod_shot_render_real.sh || FAILED=1

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-2: Video MP4 Validity..."
  bash tools/gate/gates/gate-prod_video_mp4_valid.sh || FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-3: E2E Pipeline..."
  bash tools/gate/gates/gate-prod_e2e_novel_to_video.sh || FAILED=1
fi

# 3. Archive & Summary
if [ $FAILED -eq 0 ]; then
  echo ""
  echo "--- Archiving Standard Evidence ---"
  
  # Standardize directory structure
  mv .gate_evidence/shot_render/input.json "${EVIDENCE_DIR}/input.json" || true
  mv .gate_evidence/shot_render/assets.json "${EVIDENCE_DIR}/assets.json" || true
  mv .gate_evidence/video_valid/ffprobe.json "${EVIDENCE_DIR}/ffprobe.json" || true
  mv .gate_evidence/video_sample.mp4 "${EVIDENCE_DIR}/video.mp4" || true
  mv .gate_evidence/shot_images "${EVIDENCE_DIR}/shot_images" || true
  
  # Generate Summary
  cat > "${EVIDENCE_DIR}/summary.md" <<EOF
# Phase 0-R Production Readiness Summary
- **Timestamp**: $TIMESTAMP
- **Status**: SUCCESS (Hard Locked)
- **Lockdown Checks**:
    - [x] Router Anti-Fallback (Negative Test Passed)
    - [x] Retry Limit <= 3 (Negative Test Passed)
    - [x] Real SHA256 Verification (Passed)
    - [x] FFmpeg MP4 Validation (Passed)
- **Commit SHA**: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
EOF

  echo "===================================================="
  echo " SUCCESS: PHASE 0-R LOCK-DOWN COMPLETE"
  echo " Evidence: ${EVIDENCE_DIR}"
  echo "===================================================="
else
  exit 1
fi

# gate-prod_video_readiness.sh
# Phase 0-R Total Gate (Commercial Grade)

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVIDENCE_DIR="docs/_evidence/PROD_VIDEO_READINESS_${TIMESTAMP}"
API_URL=${API_URL:-"http://localhost:3000"}

mkdir -p "${EVIDENCE_DIR}"
rm -rf .gate_evidence && mkdir -p .gate_evidence
mkdir -p .gate_evidence/shot_images

echo "===================================================="
echo " PHASE 0-R: PRODUCTION VIDEO READINESS (COMPREHENSIVE)"
echo " Started at: $(date)"
echo "===================================================="

# 1. Negative Tests (Lock-Down Verification)
FAILED=0

echo ""
echo ">>> NEGATIVE-1: Router Anti-Fallback (No Token)"
( unset REPLICATE_API_TOKEN; export SHOT_RENDER_PROVIDER=replicate; \
  res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_1\"}"); \
  if [ "$res" == "400" ] || [ "$res" == "500" ]; then echo "INTERCEPTED ($res)"; else echo "FAIL (Allowed $res)"; exit 1; fi ) || FAILED=1

echo ""
echo ">>> NEGATIVE-2: Retry Limit (attempt > 3)"
# Manual trigger through admin gate with high attempt
res=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/admin/prod-gate/shot-render" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"test\",\"projectId\":\"neg_2\",\"jobId\":\"retry_test\",\"attempt\":4}")
if [ "$res" == "400" ] || [ "$res" == "500" ]; then 
  echo "INTERCEPTED ($res): Retry limit enforced."
else 
  echo "FAIL ($res): Retry limit ignored."
  FAILED=1
fi

if [ $FAILED -ne 0 ]; then
  echo "ERROR: Negative tests failed. Logic lockdown is not effective."
  exit 1
fi

# 2. Positive Tests
echo ""
echo ">>> POSITIVE-1: Shot Render Realness..."
bash tools/gate/gates/gate-prod_shot_render_real.sh || FAILED=1

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-2: Video MP4 Validity..."
  bash tools/gate/gates/gate-prod_video_mp4_valid.sh || FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo ">>> POSITIVE-3: E2E Pipeline..."
  bash tools/gate/gates/gate-prod_e2e_novel_to_video.sh || FAILED=1
fi

# 3. Archive & Summary
if [ $FAILED -eq 0 ]; then
  echo ""
  echo "--- Archiving Standard Evidence ---"
  
  # Standardize directory structure
  mv .gate_evidence/shot_render/input.json "${EVIDENCE_DIR}/input.json" || true
  mv .gate_evidence/shot_render/assets.json "${EVIDENCE_DIR}/assets.json" || true
  mv .gate_evidence/video_valid/ffprobe.json "${EVIDENCE_DIR}/ffprobe.json" || true
  mv .gate_evidence/video_sample.mp4 "${EVIDENCE_DIR}/video.mp4" || true
  mv .gate_evidence/shot_images "${EVIDENCE_DIR}/shot_images" || true
  
  # Generate Summary
  cat > "${EVIDENCE_DIR}/summary.md" <<EOF
# Phase 0-R Production Readiness Summary
- **Timestamp**: $TIMESTAMP
- **Status**: SUCCESS (Hard Locked)
- **Lockdown Checks**:
    - [x] Router Anti-Fallback (Negative Test Passed)
    - [x] Retry Limit <= 3 (Negative Test Passed)
    - [x] Real SHA256 Verification (Passed)
    - [x] FFmpeg MP4 Validation (Passed)
- **Commit SHA**: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
EOF

  echo "===================================================="
  echo " SUCCESS: PHASE 0-R LOCK-DOWN COMPLETE"
  echo " Evidence: ${EVIDENCE_DIR}"
  echo "===================================================="
else
  exit 1
fi
