#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${ARTIFACT_DIR:?ARTIFACT_DIR required}"
MP4="$ARTIFACT_DIR/shot_render_output.mp4"
FFP="$ARTIFACT_DIR/shot_render_output.ffprobe.json"
SHA="$ARTIFACT_DIR/shot_render_output.sha256"
META="$ARTIFACT_DIR/shot_render_output.meta.json"
MARK="$ARTIFACT_DIR/ORIGIN_NATIVE_DROP_OK.txt"

hash_file() {
  local f="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  else
    echo "❌ neither shasum nor sha256sum found" >&2
    exit 1
  fi
}

test -s "$MP4"  || { echo "❌ missing/empty: $MP4"; exit 1; }
test -s "$FFP"  || { echo "❌ missing/empty: $FFP"; exit 1; }
test -s "$SHA"  || { echo "❌ missing/empty: $SHA"; exit 1; }
test -s "$META" || { echo "❌ missing/empty: $META"; exit 1; }
test -s "$MARK" || { echo "❌ missing/empty: $MARK"; exit 1; }

REC="$(tr -d ' \n\r\t' < "$SHA")"
REAL="$(hash_file "$MP4")"
[ "$REC" = "$REAL" ] || { echo "❌ sha256 mismatch"; echo "REC=$REC"; echo "REAL=$REAL"; exit 1; }

grep -q "^OK ORIGIN_NATIVE_DROP" "$MARK" || { echo "❌ marker invalid"; exit 1; }

echo "✅ ORIGIN_NATIVE_DROP contract OK"
