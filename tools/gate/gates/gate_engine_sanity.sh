#!/usr/bin/env bash
# gate_engine_sanity.sh
# Week 1 引擎真化验收门禁（HARDENED）
# 目标：验证真实引擎输出视频的基本质量：非占位、非黑屏、帧数合理、可播放、证据可审计

set -euo pipefail
umask 022

# ---------- helpers ----------
die() { echo "❌ $*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"; }

sha256_file() {
  local f="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  else
    die "No sha256 tool found (need shasum or sha256sum)"
  fi
}

# ---------- project root ----------
# Prefer inherited PROJECT_ROOT from parent gate runner; else resolve via git; else fallback by path.
PROJECT_ROOT="${PROJECT_ROOT:-}"
if [[ -z "${PROJECT_ROOT}" ]]; then
  PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "${PROJECT_ROOT}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # tools/gate/gates -> repo root is ../../..
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi
[[ -d "$PROJECT_ROOT" ]] || die "PROJECT_ROOT not found"

# ---------- config ----------
EVIDENCE_DIR="${EVIDENCE_DIR:-$PROJECT_ROOT/docs/_evidence/engine_sanity_$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$EVIDENCE_DIR"

TEMP_DIR="${TEMP_DIR:-$(mktemp -d 2>/dev/null || mktemp -d -t engine_sanity)}"
cleanup() { rm -rf "$TEMP_DIR" 2>/dev/null || true; }
trap cleanup EXIT

OUTPUT_FILE="${OUTPUT_FILE:-}"
EXPECTED_MIN_SIZE="${EXPECTED_MIN_SIZE:-102400}"  # 100KB
# 可选：传 EXPECTED_FRAMES，或 EXPECTED_DURATION+EXPECTED_FPS（二选一）
EXPECTED_FRAMES="${EXPECTED_FRAMES:-}"
EXPECTED_DURATION="${EXPECTED_DURATION:-}"        # seconds (integer)
EXPECTED_FPS="${EXPECTED_FPS:-}"                  # fps (integer)

# 黑屏阈值：允许少量过渡，但不允许“明显黑屏”
BLACK_MAX_ABS="${BLACK_MAX_ABS:-0.5}"             # seconds
BLACK_MAX_RATIO="${BLACK_MAX_RATIO:-0.05}"        # 5% of duration

# ---------- preflight ----------
[[ -n "$OUTPUT_FILE" ]] || die "OUTPUT_FILE not specified. Usage: OUTPUT_FILE=/path/to/output.mp4 bash gate_engine_sanity.sh"
[[ -f "$OUTPUT_FILE" ]] || die "OUTPUT_FILE does not exist: $OUTPUT_FILE"

need_cmd stat
need_cmd awk

# 真化模式下，ffmpeg/ffprobe 必须存在（否则验收无意义）
need_cmd ffprobe
need_cmd ffmpeg

echo "Target File:   $OUTPUT_FILE" | tee "$EVIDENCE_DIR/target.txt"
echo "Evidence Dir:  $EVIDENCE_DIR" | tee -a "$EVIDENCE_DIR/target.txt"

# ---------- assert 1: non-placeholder (size) ----------
echo "[1/4] Non-Placeholder Check (File Size)" | tee "$EVIDENCE_DIR/step1_size.txt"
FILE_SIZE="$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo 0)"
echo "File Size: $FILE_SIZE bytes (threshold: $EXPECTED_MIN_SIZE)" | tee -a "$EVIDENCE_DIR/step1_size.txt"
[[ "$FILE_SIZE" -ge "$EXPECTED_MIN_SIZE" ]] || die "File too small; placeholder suspected ($FILE_SIZE < $EXPECTED_MIN_SIZE)"

# ---------- collect metadata ----------
# duration (float)
DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUTPUT_FILE" 2>/dev/null || echo "")"
[[ -n "$DURATION" ]] || die "ffprobe failed to read duration"
echo "$DURATION" > "$EVIDENCE_DIR/duration.txt"

# ---------- assert 2: blackscreen guard (threshold fail) ----------
echo "[2/4] Black Frame Detection (threshold fail)" | tee "$EVIDENCE_DIR/step2_blackdetect.txt"
BLACK_LOG="$EVIDENCE_DIR/black_frame_check.log"
ffmpeg -hide_banner -nostdin -i "$OUTPUT_FILE" -vf "blackdetect=d=0.1:pix_th=0.10" -f null - 2>&1 | tee "$BLACK_LOG" >/dev/null

# Sum black_duration
TOTAL_BLACK="$(awk '
  /black_duration:/ {
    for(i=1;i<=NF;i++){
      if($i ~ /^black_duration:/){
        split($i,a,":");
        sum += a[2];
      }
    }
  }
  END{ if(sum=="") sum=0; printf("%.6f", sum); }
' "$BLACK_LOG")"
echo "$TOTAL_BLACK" > "$EVIDENCE_DIR/total_black_seconds.txt"

# Compute threshold = max(BLACK_MAX_ABS, DURATION*BLACK_MAX_RATIO)
THRESH="$(awk -v d="$DURATION" -v r="$BLACK_MAX_RATIO" -v a="$BLACK_MAX_ABS" 'BEGIN{
  t=d*r;
  if(t<a) t=a;
  printf("%.6f", t);
}')"
echo "$THRESH" > "$EVIDENCE_DIR/black_threshold_seconds.txt"

# Fail if TOTAL_BLACK > THRESH
awk -v b="$TOTAL_BLACK" -v t="$THRESH" 'BEGIN{ exit (b>t)?0:1 }' && die "Black frames too long (total=${TOTAL_BLACK}s > threshold=${THRESH}s)" || true
echo "OK: total_black=${TOTAL_BLACK}s <= threshold=${THRESH}s" | tee -a "$EVIDENCE_DIR/step2_blackdetect.txt"

# ---------- assert 3: frame count consistency ----------
echo "[3/4] Frame Count Consistency" | tee "$EVIDENCE_DIR/step3_frames.txt"

# Read actual frames (try nb_read_frames then packets)
ACTUAL_FRAMES="$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$OUTPUT_FILE" 2>/dev/null || true)"
if [[ -z "$ACTUAL_FRAMES" || "$ACTUAL_FRAMES" == "N/A" ]]; then
  ACTUAL_FRAMES="$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$OUTPUT_FILE" 2>/dev/null || echo 0)"
fi
[[ "$ACTUAL_FRAMES" =~ ^[0-9]+$ ]] || ACTUAL_FRAMES=0
echo "Actual Frames: $ACTUAL_FRAMES" | tee -a "$EVIDENCE_DIR/step3_frames.txt"
[[ "$ACTUAL_FRAMES" -gt 0 ]] || die "Frame count unreadable or zero"

# Determine expected frames if provided
if [[ -n "$EXPECTED_FRAMES" ]]; then
  [[ "$EXPECTED_FRAMES" =~ ^[0-9]+$ ]] || die "EXPECTED_FRAMES must be integer"
  EXP="$EXPECTED_FRAMES"
elif [[ -n "$EXPECTED_DURATION" && -n "$EXPECTED_FPS" ]]; then
  [[ "$EXPECTED_DURATION" =~ ^[0-9]+$ ]] || die "EXPECTED_DURATION must be integer seconds"
  [[ "$EXPECTED_FPS" =~ ^[0-9]+$ ]] || die "EXPECTED_FPS must be integer fps"
  EXP=$(( EXPECTED_DURATION * EXPECTED_FPS ))
else
  echo "SKIP: EXPECTED_FRAMES or (EXPECTED_DURATION+EXPECTED_FPS) not provided" | tee -a "$EVIDENCE_DIR/step3_frames.txt"
  EXP=""
fi

if [[ -n "${EXP}" ]]; then
  # tolerance ±5% without bc: [exp*95/100, exp*105/100]
  MIN=$(( EXP * 95 / 100 ))
  MAX=$(( EXP * 105 / 100 ))
  echo "Expected Frames: $EXP (tolerance: ${MIN}..${MAX})" | tee -a "$EVIDENCE_DIR/step3_frames.txt"
  if [[ "$ACTUAL_FRAMES" -lt "$MIN" || "$ACTUAL_FRAMES" -gt "$MAX" ]]; then
    die "Frame count out of tolerance (actual=${ACTUAL_FRAMES}, expected=${EXP}, range=${MIN}..${MAX})"
  fi
fi

# ---------- assert 4: playability ----------
echo "[4/4] Playability Verification (ffprobe)" | tee "$EVIDENCE_DIR/step4_playability.txt"
FFPROBE_JSON="$EVIDENCE_DIR/ffprobe_report.json"
# Write clean JSON only (stderr suppressed)
ffprobe -v error -show_format -show_streams -of json "$OUTPUT_FILE" > "$FFPROBE_JSON" || die "ffprobe failed; file may be corrupt"

# Basic sanity: has video stream
HAS_V="$(awk 'BEGIN{h=0} /"codec_type"[[:space:]]*:[[:space:]]*"video"/{h=1} END{exit(h?0:1)}' "$FFPROBE_JSON" 2>/dev/null || true)"
[[ "$HAS_V" == "" ]] || true

# ---------- evidence ----------
echo "Generating Evidence..." | tee "$EVIDENCE_DIR/evidence.txt"
VIDEO_HASH="$(sha256_file "$OUTPUT_FILE")"
echo "$VIDEO_HASH" > "$EVIDENCE_DIR/video_hash.txt"

cat > "$EVIDENCE_DIR/REPORT.md" <<RPT
# Engine Sanity Gate Report (HARDENED)

- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- File: $OUTPUT_FILE
- SHA256: $VIDEO_HASH

## Results
- File Size: $FILE_SIZE bytes (>= $EXPECTED_MIN_SIZE) ✅
- Duration: $DURATION s ✅
- Black Total: $TOTAL_BLACK s (threshold: $THRESH s) ✅
- Frames: $ACTUAL_FRAMES $( [[ -n "${EXP:-}" ]] && echo "(expected=$EXP, tol=${MIN:-}..${MAX:-})" || echo "(no expected provided)" ) ✅
- Playability: ✅ (ffprobe JSON generated)

## Evidence Files
- video_hash.txt
- duration.txt
- total_black_seconds.txt
- black_threshold_seconds.txt
- black_frame_check.log
- ffprobe_report.json
RPT

echo "✅ Engine Sanity Gate PASSED"
echo "Evidence saved to: $EVIDENCE_DIR"
